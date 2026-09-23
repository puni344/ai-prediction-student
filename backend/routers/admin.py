"""Main Administrator router for institution-wide overview, student management, and faculty management."""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models.user import User
from backend.models.profile import StudentProfile, FacultyProfile
from backend.models.department import Department, FacultyDepartment
from backend.models.prediction import PredictionRecord
from backend.schemas.student import StudentProfileResponse
from backend.schemas.prediction import PredictionResponse, DailySnapshotResponse
from backend.services.snapshot_service import get_student_snapshots
from backend.schemas.faculty import FacultyStudentDetailResponse
from backend.schemas.admin import (
    AdminOverviewResponse,
    AdminStudentItem,
    AdminStudentListResponse,
    AdminFacultyItem,
    AdminFacultyListResponse,
)
from backend.security import require_role

router = APIRouter(prefix="/admin", tags=["Administrator"])


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    department: Optional[str] = Query(None, description="Optional department filter"),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Provide authoritative institution-wide analytics and cohort distribution."""
    # 1. Base queries
    student_query = db.query(StudentProfile)
    faculty_query = db.query(FacultyProfile)

    if department and department.strip() and department.strip() != "all":
        dept_clean = department.strip()
        student_query = student_query.filter(
            (StudentProfile.department.ilike(f"%{dept_clean}%"))
        )
        # For faculty: multi-department match
        faculty_query = faculty_query.join(FacultyProfile.departments).filter(
            (Department.name.ilike(f"%{dept_clean}%")) | (Department.code.ilike(f"%{dept_clean}%"))
        ).distinct()

    students = student_query.all()
    faculty_list = faculty_query.all()

    total_students = len(students)
    total_faculty = len(faculty_list)

    # 2. Risk & Prediction stats for selected students
    scores = []
    probs = []
    risk_counts = {"HIGH": 0, "MODERATE": 0, "LOW": 0}
    total_preds = 0

    for sp in students:
        latest = (
            db.query(PredictionRecord)
            .filter(PredictionRecord.student_id == sp.id)
            .order_by(PredictionRecord.created_at.desc())
            .first()
        )
        if latest:
            total_preds += 1
            scores.append(latest.predicted_score)
            probs.append(latest.pass_probability)
            tier = latest.risk_level.upper()
            if tier in risk_counts:
                risk_counts[tier] += 1
            else:
                risk_counts["LOW"] += 1

    avg_score = round(sum(scores) / len(scores), 2) if scores else None
    avg_prob = round(sum(probs) / len(probs), 4) if probs else None

    # 3. Department breakdown: honor the selected department filter
    all_depts = db.query(Department).all()
    if department and department.strip() and department.strip() != "all":
        dept_filter = department.strip().lower()
        filtered_depts = [d for d in all_depts if dept_filter in d.name.lower() or dept_filter in (d.code or '').lower()]
    else:
        filtered_depts = all_depts

    students_by_dept = []
    faculty_by_dept = []
    dept_performance = []

    for d in filtered_depts:
        s_count = db.query(StudentProfile).filter(
            (StudentProfile.department_id == d.id) | (StudentProfile.department == d.name)
        ).count()
        students_by_dept.append({"department": d.name, "code": d.code, "count": s_count})

        # Faculty count for department
        f_count = db.query(FacultyDepartment).filter(FacultyDepartment.department_id == d.id).count()
        faculty_by_dept.append({"department": d.name, "code": d.code, "count": f_count})

        # Performance summary by department
        d_students = db.query(StudentProfile).filter(
            (StudentProfile.department_id == d.id) | (StudentProfile.department == d.name)
        ).all()
        d_scores = []
        d_high_risk = 0
        for ds in d_students:
            dl = (
                db.query(PredictionRecord)
                .filter(PredictionRecord.student_id == ds.id)
                .order_by(PredictionRecord.created_at.desc())
                .first()
            )
            if dl:
                d_scores.append(dl.predicted_score)
                if dl.risk_level.upper() == "HIGH":
                    d_high_risk += 1
        
        dept_performance.append({
            "department": d.name,
            "code": d.code,
            "students": s_count,
            "faculty": f_count,
            "avg_score": round(sum(d_scores) / len(d_scores), 1) if d_scores else None,
            "high_risk_count": d_high_risk,
        })

    return AdminOverviewResponse(
        total_students=total_students,
        total_faculty=total_faculty,
        total_predictions=total_preds,
        risk_distribution=risk_counts,
        average_predicted_score=avg_score,
        average_pass_probability=avg_prob,
        students_by_department=students_by_dept,
        faculty_by_department=faculty_by_dept,
        department_performance=dept_performance,
    )


@router.get("/students", response_model=AdminStudentListResponse)
def get_admin_students(
    search: Optional[str] = Query(None, description="Search by name, roll number, or email"),
    department: Optional[str] = Query(None, description="Filter by department"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Retrieve institution-wide list of students with filters."""
    query = db.query(StudentProfile, User).join(User, StudentProfile.user_id == User.id)

    if search:
        s_pat = f"%{search.strip()}%"
        query = query.filter(
            (User.full_name.ilike(s_pat)) |
            (User.email.ilike(s_pat)) |
            (StudentProfile.roll_number.ilike(s_pat))
        )

    if department and department.strip() and department.strip() != "all":
        query = query.filter(StudentProfile.department.ilike(f"%{department.strip()}%"))

    matches = query.all()
    items: List[AdminStudentItem] = []

    for sp, u in matches:
        latest = (
            db.query(PredictionRecord)
            .filter(PredictionRecord.student_id == sp.id)
            .order_by(PredictionRecord.created_at.desc())
            .first()
        )
        latest_risk = latest.risk_level.upper() if latest else None

        if risk_level and latest_risk != risk_level.upper():
            continue

        items.append(
            AdminStudentItem(
                id=sp.id,
                user_id=u.id,
                full_name=u.full_name,
                email=u.email,
                roll_number=sp.roll_number,
                department=sp.department,
                academic_year=sp.academic_year,
                program=sp.program,
                attendance=sp.attendance,
                study_hours=sp.study_hours,
                latest_predicted_score=latest.predicted_score if latest else None,
                latest_pass_fail=latest.pass_fail if latest else None,
                latest_pass_probability=latest.pass_probability if latest else None,
                latest_risk_level=latest_risk,
                latest_risk_index=latest.risk_index if latest else None,
                last_prediction_date=latest.created_at if latest else None,
            )
        )

    total = len(items)
    paginated = items[skip : skip + limit]

    return AdminStudentListResponse(total=total, skip=skip, limit=limit, students=paginated)


@router.get("/students/{id}", response_model=FacultyStudentDetailResponse)
def get_admin_student_detail(
    id: int,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Retrieve complete profile and prediction history for any student across the institution."""
    sp = db.query(StudentProfile).filter(StudentProfile.id == id).first()
    if not sp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    user = db.query(User).filter(User.id == sp.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User record not found")

    records = (
        db.query(PredictionRecord)
        .filter(PredictionRecord.student_id == sp.id)
        .order_by(PredictionRecord.created_at.desc())
        .all()
    )

    history: List[PredictionResponse] = []
    for r in records:
        shap_data = r.shap_summary or {}
        history.append(
            PredictionResponse(
                id=r.id,
                predicted_score=r.predicted_score,
                pass_fail=r.pass_fail,
                pass_probability=r.pass_probability,
                confidence_score=r.confidence_score,
                risk_level=r.risk_level,
                risk_index=r.risk_index,
                risk_description=r.risk_description or "",
                base_value=r.base_value or 0.0,
                shap_consistency=True,
                top_positive=shap_data.get("top_positive", []),
                top_negative=shap_data.get("top_negative", []),
                model_comparison=r.model_comparison or {},
                created_at=r.created_at,
            )
        )

    latest_pred = history[0] if history else None

    return FacultyStudentDetailResponse(
        profile=StudentProfileResponse.model_validate(sp),
        full_name=user.full_name,
        email=user.email,
        latest_prediction=latest_pred,
        prediction_history=history,
    )


@router.get("/faculty", response_model=AdminFacultyListResponse)
def get_admin_faculty(
    search: Optional[str] = Query(None, description="Search by faculty name, ID, or email"),
    department: Optional[str] = Query(None, description="Filter by department"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Retrieve institution-wide list of faculty with multi-department filtering."""
    query = db.query(FacultyProfile, User).join(User, FacultyProfile.user_id == User.id)

    if search:
        s_pat = f"%{search.strip()}%"
        query = query.filter(
            (User.full_name.ilike(s_pat)) |
            (User.email.ilike(s_pat)) |
            (FacultyProfile.faculty_id.ilike(s_pat))
        )

    matches = query.all()
    items: List[AdminFacultyItem] = []

    for fp, u in matches:
        # Get assigned departments
        depts = fp.departments or []
        assigned_names = [d.name for d in depts] if depts else ([fp.department] if fp.department else [])

        # If filtering by department, ensure match in assigned departments
        if department and department.strip() and department.strip() != "all":
            d_clean = department.strip().lower()
            dept_matches = any(d_clean in name.lower() for name in assigned_names)
            if not dept_matches:
                continue

        items.append(
            AdminFacultyItem(
                id=fp.id,
                user_id=u.id,
                full_name=u.full_name,
                email=u.email,
                faculty_id=fp.faculty_id,
                designation=fp.designation or "Faculty Advisor",
                department=fp.department or (assigned_names[0] if assigned_names else "General"),
                assigned_departments=assigned_names,
                created_at=fp.created_at,
            )
        )

    total = len(items)
    paginated = items[skip : skip + limit]

    return AdminFacultyListResponse(total=total, skip=skip, limit=limit, faculty=paginated)


@router.get("/departments")
def get_admin_departments(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Retrieve all academic departments with active student and faculty counts."""
    depts = db.query(Department).order_by(Department.name).all()
    results = []
    for d in depts:
        s_count = db.query(StudentProfile).filter(
            (StudentProfile.department_id == d.id) | (StudentProfile.department == d.name)
        ).count()
        f_count = db.query(FacultyDepartment).filter(FacultyDepartment.department_id == d.id).count()
        results.append({
            "id": d.id,
            "code": d.code,
            "name": d.name,
            "student_count": s_count,
            "faculty_count": f_count,
            "is_active": d.is_active,
        })
    return results


# ─── Academic Calendar Admin Endpoints ───────────────────────────────

@router.get("/calendar")
@router.get("/calendar/entries")
def admin_get_calendar(
    year: int = 2026,
    current_user = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Admin view: academic calendar with override counts."""
    from backend.services.academic_calendar.calendar_models import (
        AcademicCalendar,
        StudentCalendarOverride,
        AdminCalendarOverride,
    )

    entries = db.query(AcademicCalendar).filter(
        AcademicCalendar.calendar_year == year,
        AcademicCalendar.is_active == True,
    ).order_by(AcademicCalendar.date).all()

    result = []
    for entry in entries:
        student_overrides = db.query(StudentCalendarOverride).filter(
            StudentCalendarOverride.date == entry.date,
        ).count()

        admin_override = db.query(AdminCalendarOverride).filter(
            AdminCalendarOverride.date == entry.date,
        ).first()

        # Source label according to spec: AP Government, Calendarific, Admin Manual
        source_label = "AP Government" if entry.holiday_source == "AP_GOVERNMENT" else "Calendarific"
        if admin_override:
            source_label = "Admin Manual"

        result.append({
            "date": entry.date,
            "name": entry.name,
            "category": entry.holiday_category,
            "source": source_label,
            "raw_source": entry.holiday_source,
            "is_public_holiday": entry.is_public_holiday,
            "is_default_no_college": entry.is_default_no_college,
            "student_override_count": student_overrides,
            "locked": bool(admin_override),
            "admin_override": {
                "college_status": admin_override.college_status,
                "reason": admin_override.reason,
            } if admin_override else None,
        })

    return {"year": year, "entries": result, "total": len(result)}


@router.put("/calendar/{date}")
def admin_create_override(
    date: str,
    college_status: bool = True,
    reason: str = None,
    current_user = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Create or update institution-wide calendar override."""
    from backend.services.academic_calendar.calendar_models import (
        AdminCalendarOverride,
        OverrideType,
    )

    override_type = OverrideType.COLLEGE_DAY.value if college_status else OverrideType.HOLIDAY.value

    existing = db.query(AdminCalendarOverride).filter(
        AdminCalendarOverride.date == date,
    ).first()

    if existing:
        existing.override_type = override_type
        existing.college_status = college_status
        existing.reason = reason
        existing.created_by = current_user.email
        msg = "Admin override updated"
    else:
        db.add(AdminCalendarOverride(
            date=date,
            override_type=override_type,
            college_status=college_status,
            reason=reason,
            created_by=current_user.email,
        ))
        msg = "Admin override created"

    db.commit()
    return {"date": date, "college_status": college_status, "message": msg}


@router.delete("/calendar/{date}")
def admin_delete_override(
    date: str,
    current_user = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Remove institution-wide calendar override."""
    from backend.services.academic_calendar.calendar_models import AdminCalendarOverride

    existing = db.query(AdminCalendarOverride).filter(
        AdminCalendarOverride.date == date,
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="No admin override found for this date")

    db.delete(existing)
    db.commit()
    return {"date": date, "message": "Admin override removed"}


@router.post("/calendar/sync")
def admin_trigger_sync(
    year: int = 2026,
    current_user = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Manually trigger academic calendar sync using Calendarific v2."""
    from backend.services.academic_calendar.calendar_sync_service import sync_calendar_for_year
    from backend.services.academic_calendar.calendarific_client import CalendarificClient
    from backend.config import settings as cal_settings

    client = CalendarificClient(
        api_key=cal_settings.CALENDARIFIC_API_KEY,
        base_url=cal_settings.CALENDARIFIC_BASE_URL,
        country=cal_settings.CALENDARIFIC_COUNTRY,
        location=cal_settings.CALENDARIFIC_LOCATION,
    )
    result = sync_calendar_for_year(db, client, year, force=True)
    msg = result.get("message") or f"Calendar sync completed for {year}."
    return {"message": msg, "result": result}

@router.get("/students/{id}/snapshots", response_model=List[DailySnapshotResponse])
def get_admin_student_snapshots(
    id: int,
    limit: int = Query(60, ge=1, le=365),
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    """Retrieve historical daily snapshots for any student across the institution."""
    sp = db.query(StudentProfile).filter(StudentProfile.id == id).first()
    if not sp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return get_student_snapshots(db=db, student_id=id, limit=limit)
