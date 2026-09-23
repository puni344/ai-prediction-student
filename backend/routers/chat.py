"""API Router for Academic AI Advisor Chat Sessions."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.profile import StudentProfile
from backend.models.chat import ChatSession, ChatMessage
from backend.security import get_current_user
from backend.schemas.ai import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
)
from backend.ai.context_builder import build_student_ai_context
from backend.ai.capabilities import detect_and_execute_capability
from backend.ai.client import get_ai_client, DevelopmentMockAIClient

router = APIRouter(prefix="/chat", tags=["AI Advisor Chat"])


@router.get("/sessions", response_model=List[ChatSessionResponse])
def get_student_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all chat sessions for the authenticated student."""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat advisory sessions are private to student accounts.",
        )

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        return []

    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.student_id == profile.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )

    res = []
    for s in sessions:
        count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        res.append(
            ChatSessionResponse(
                id=s.id,
                student_id=s.student_id,
                title=s.title,
                created_at=s.created_at,
                updated_at=s.updated_at,
                message_count=count,
            )
        )
    return res


@router.post("/sessions", response_model=ChatSessionResponse)
def create_chat_session(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new chat session for the authenticated student."""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat advisory sessions are private to student accounts.",
        )

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student profile required.")

    # Context snapshot contains ONLY minimized academic data (zero PII/demographics)
    context = build_student_ai_context(db, current_user)
    snapshot = {
        "academic_metrics": context.get("academic_metrics"),
        "verified_predictions": context.get("verified_predictions"),
    }

    session_obj = ChatSession(
        student_id=profile.id,
        title=payload.title or "Academic Advisory Session",
    )
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)

    return ChatSessionResponse(
        id=session_obj.id,
        student_id=session_obj.student_id,
        title=session_obj.title,
        created_at=session_obj.created_at,
        updated_at=session_obj.updated_at,
        message_count=0,
    )


@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve message history for a specific chat session with student isolation check."""
    if current_user.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student profile required.")

    session_obj = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.student_id == profile.id)
        .first()
    )
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found or access denied.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return messages


@router.post("/message", response_model=ChatMessageResponse)
def send_chat_message(
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send message to AI advisor, grounded in live verified student context."""
    if current_user.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student profile required.")

    # Find or auto-create session
    session_obj = None
    if payload.session_id:
        session_obj = (
            db.query(ChatSession)
            .filter(ChatSession.id == payload.session_id, ChatSession.student_id == profile.id)
            .first()
        )
        if not session_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    else:
        # Auto-create session
        session_obj = ChatSession(
            student_id=profile.id,
            title=payload.message[:30] + "..." if len(payload.message) > 30 else payload.message,
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

    # Save user message
    user_msg = ChatMessage(
        session_id=session_obj.id,
        role="user",
        content=payload.message,
    )
    db.add(user_msg)
    db.commit()

    # Retrieve live authoritative context from DB (rather than stale snapshot)
    context = build_student_ai_context(db, current_user)

    # Retrieve previous conversation messages for history
    past_msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_obj.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in past_msgs]

    # Capability detection & deterministic service execution
    capability, cap_payload, context_used = detect_and_execute_capability(
        payload.message, history, context
    )

    if capability == "UNSUPPORTED":
        # Strict controlled response: do NOT call Gemini for unsupported questions
        answer = (
            "I can help with the questions supported by your Academic Advisor. "
            "Please select one of the options above."
        )
        ai_status = "controlled_advisor"
    else:
        # Generate assistant answer with live provider or deterministic fallback
        ai_client, provider_status = get_ai_client()
        ai_status = provider_status
        try:
            answer = ai_client.chat_answer(
                payload.message,
                history,
                context,
                capability=capability,
                capability_payload=cap_payload,
            )
        except Exception as e:
            ai_status = "deterministic_fallback"
            answer = DevelopmentMockAIClient().chat_answer(
                payload.message,
                history,
                context,
                capability=capability,
                capability_payload=cap_payload,
            )

    assistant_msg = ChatMessage(
        session_id=session_obj.id,
        role="assistant",
        content=answer,
        context_snapshot={
            "context_used": context_used,
            "capability_used": capability,
            "ai_status": ai_status,
        },
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return assistant_msg


@router.delete("/history")
def delete_all_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete all chat history for the authenticated student with strict ownership enforcement."""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat history deletion is restricted to student accounts.",
        )

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found.")

    sessions = db.query(ChatSession).filter(ChatSession.student_id == profile.id).all()
    session_ids = [s.id for s in sessions]

    if session_ids:
        db.query(ChatMessage).filter(ChatMessage.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(ChatSession).filter(ChatSession.student_id == profile.id).delete(synchronize_session=False)
        db.commit()

    return {"success": True, "message": "All chat history permanently deleted."}


@router.delete("/sessions/{session_id}")
def delete_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a specific chat session for the authenticated student."""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat session deletion is restricted to student accounts.",
        )

    profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found.")

    sess = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.student_id == profile.id).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found or access denied.")

    db.query(ChatMessage).filter(ChatMessage.session_id == sess.id).delete(synchronize_session=False)
    db.delete(sess)
    db.commit()

    return {"success": True, "message": "Chat session permanently deleted."}
