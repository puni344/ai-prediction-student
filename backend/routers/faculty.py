"""Faculty cohort management, directory, analytics, and risk monitoring endpoints with backend data isolation."""
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models.user import User
from backend.models.profile import StudentProfile, FacultyProfile
from backend.models.department import Department
from backend.models.prediction import PredictionRecord, DailyPredictionSnapshot
from backend.schemas.student import StudentProfileResponse
from backend.schemas.prediction import (
    PredictionResponse,
    DailySnapshotResponse,
    SnapshotTrendResponse,
)
from backend.schemas.faculty import (
    FacultyDashboardResponse,
    FacultyStudentItem,
    FacultyStudentListResponse,
    FacultyStudentDetailResponse,
    FacultyAnalyticsResponse,
    ScatterPoint,
    FacultyRiskItem,
    FacultyRiskResponse,
)
from backend.security import require_role
from backend.services.snapshot_service import (
    get_student_snapshots,
    get_snapshot_trends,
)

router = APIRouter(prefix="/faculty", tags=["Faculty"])


def get_faculty_assigned_departments(current_user: User, db: Session) -> List[Department]:
    """Retrieve canonical departments assigned to the currently authenticated faculty member."""
    profile = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
    if not profile:
        return []
    # If many-to-many relationship has departments, return them
    if profile.departments:
        return profile.departments
    # Fallback to single department string if present
    if profile.department:
        dept = db.query(Department).filter(
            (Department.name.ilike(profile.department.strip())) |
            (Department.code.ilike(profile.department.strip()))
        ).first()
        if dept:
            return [dept]
    return []


def filter_students_by_faculty_departments(
    query,
    faculty_depts: List[Department],
):
    """Filter StudentProfile query strictly to faculty's assigned departments."""
    if not faculty_depts:
        # If faculty has no assigned departments, match nothing
        return query.filter(StudentProfile.id == -1)
    
    dept_ids = [d.id for d in faculty_depts]
    dept_names = [d.name for d in faculty_depts]
    return query.filter(
        (StudentProfile.department_id.in_(dept_ids)) |
        (StudentProfile.department.in_(dept_names))
    )


def verify_faculty_access_to_student(
    student_id: int,
    current_user: User,
    db: Session,
) -> StudentProfile:
    """Verify that the student exists and is enrolled in one of the faculty member's assigned departments.
    Raises 404 if not found or unauthorized (prevents existence leakage).
    """
    sp = db.query(StudentProfile).filter(StudentProfile.id == student_id).first()
    if not sp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    faculty_depts = get_faculty_assigned_departments(current_user, db)
    assigned_dept_ids = {d.id for d in faculty_depts}
    assigned_dept_names = {d.name.lower() for d in faculty_depts}

    student_in_assigned = False
    if sp.department_id and sp.department_id in assigned_dept_ids:
        student_in_assigned = True
    elif sp.department and sp.department.lower() in assigned_dept_names:
        student_in_assigned = True

    if not student_in_assigned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    return sp


@router.get("/dashboard", response_model=FacultyDashboardResponse)
def get_faculty_dashboard(
    current_user: User = Depends(require_role(["faculty"])),
    db: Session = Depends(get_db),
):
    """Aggregate cohort statistics strictly across students in faculty's assigned departments."""
    faculty_depts = get_faculty_assigned_departments(current_user, db)
    assigned_dept_names = [d.name for d in faculty_depts]

    if not faculty_depts:
        return FacultyDashboardResponse(
            total_enrolled_students=0,
            students_with_predictions=0,
            high_risk_count=0,
            moderate_risk_count=0,
            low_risk_count=0,
            average_predicted_score=None,
            average_pass_probability=None,
            assigned_departments=[],
        )

    # 1. Total enrolled students in assigned departments
    sp_query = filter_students_by_faculty_departments(db.query(StudentProfile), faculty_depts)
    student_profiles = sp_query.all()
    total_students = len(student_profiles)

    # 2. Query latest prediction/snapshot for each authorized student
    students_with_preds = 0
    scores = []
    probabilities = []
    risk_counts = {"HIGH": 0, "MODERATE": 0, "LOW": 0}

    for sp in student_profiles:
        # Prioritize official daily snapshot, fallback to prediction record
        latest_snapshot = (
            db.query(DailyPredictionSnapshot)
            .filter(DailyPredictionSnapshot.student_id == sp.id)
            .order_by(DailyPredictionSnapshot.snapshot_date.desc())
            .first()
        )
        if latest_snapshot:
            students_with_preds += 1
            scores.append(latest_snapshot.predicted_score)
            probabilities.append(latest_snapshot.pass_probability)
            tier = latest_snapshot.risk_level.upper()
            if tier in risk_counts:
                risk_counts[tier] += 1
            else:
                risk_counts["LOW"] += 1
        else:
            latest_rec = (
                db.query(PredictionRecord)
                .filter(PredictionRecord.student_id == sp.id)
                .order_by(PredictionRecord.created_at.desc())
                .first()
            )
            if latest_rec:
                students_with_preds += 1
                scores.append(latest_rec.predicted_score)
                probabilities.append(latest_rec.pass_probability)
                tier = latest_rec.risk_level.upper()
                if tier in risk_counts:
                    risk_counts[tier] += 1
                else:
                    risk_counts["LOW"] += 1

    avg_score = round(sum(scores) / len(scores), 2) if scores else None
    avg_prob = round(sum(probabilities) / len(probabilities), 4) if probabilities else None

    return FacultyDashboardResponse(
        total_enrolled_students=total_students,
        students_with_predictions=students_with_preds,
        high_risk_count=risk_counts["HIGH"],
        moderate_risk_count=risk_counts["MODERATE"],
        low_risk_count=risk_counts["LOW"],
        average_predicted_score=avg_score,
        average_pass_probability=avg_prob,
        assigned_departments=assigned_dept_names,
    )


@router.get("/students", response_model=FacultyStudentListResponse)
def get_faculty_students(
    search: Optional[str] = Query(None, description="Search by student full name or email"),
    roll_number: Optional[str] = Query(None, description="Filter by exact or partial roll number"),
    department: Optional[str] = Query(None, description="Filter by department"),
    risk_level: Optional[str] = Query(None, description="Filter by latest risk level: LOW, MODERATE, HIGH"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role(["faculty"])),
    db: Session = Depends(get_db),
):
    """Retrieve filterable, searchable list of students strictly within faculty's assigned departments."""
    faculty_depts = get_faculty_assigned_departments(current_user, db)
    assigned_dept_names = [d.name.lower() for d in faculty_depts]
    assigned_dept_codes = [d.code.lower() for d in faculty_depts]

    # If department parameter is requested, verify faculty is assigned to it
    if department:
        dept_clean = department.strip().lower()
        if dept_clean not in assigned_dept_names and dept_clean not in assigned_dept_codes:
            return FacultyStudentListResponse(total=0, skip=skip, limit=limit, students=[])

    query = db.query(StudentProfile, User).join(User, StudentProfile.user_id == User.id)
    query = filter_students_by_faculty_departments(query, faculty_depts)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            (User.full_name.ilike(search_pattern)) |
            (User.email.ilike(search_pattern)) |
            (StudentProfile.roll_number.ilike(search_pattern))
        )

    if roll_number:
        query = query.filter(StudentProfile.roll_number.ilike(f"%{roll_number.strip()}%"))

    if department:
        query = query.filter(
            (StudentProfile.department.ilike(f"%{department.strip()}%"))
        )

    all_matches = query.all()
    items: List[FacultyStudentItem] = []

    for sp, u in all_matches:
        # Prioritize official daily snapshot
        latest_snap = (
            db.query(DailyPredictionSnapshot)
            .filter(DailyPredictionSnapshot.student_id == sp.id)
            .order_by(DailyPredictionSnapshot.snapshot_date.desc())
            .first()
        )
        if latest_snap:
            latest_risk = latest_snap.risk_level.upper()
            if risk_level and latest_risk != risk_level.upper():
                continue

            items.append(
                FacultyStudentItem(
                    id=sp.id,
                    user_id=u.id,
                    full_name=u.full_name,
                    email=u.email,
                    roll_number=sp.roll_number,
                    department=sp.department,
                    academic_year=sp.academic_year,
                    attendance=latest_snap.attendance,
                    study_hours=latest_snap.study_hours,
                    latest_predicted_score=latest_snap.predicted_score,
                    latest_pass_fail="Pass" if latest_snap.predicted_score >= 40.0 else "Fail",
                    latest_pass_probability=latest_snap.pass_probability,
                    latest_risk_level=latest_risk,
                    latest_risk_index=latest_snap.risk_index,
                    last_prediction_date=latest_snap.created_at,
                )
            )
        else:
            latest_rec = (
                db.query(PredictionRecord)
                .filter(PredictionRecord.student_id == sp.id)
                .order_by(PredictionRecord.created_at.desc())
                .first()
            )
            latest_risk = latest_rec.risk_level.upper() if latest_rec else None

            if risk_level and latest_risk != risk_level.upper():
                continue

            items.append(
                FacultyStudentItem(
                    id=sp.id,
                    user_id=u.id,
                    full_name=u.full_name,
                    email=u.email,
                    roll_number=sp.roll_number,
                    department=sp.department,
                    academic_year=sp.academic_year,
                    attendance=sp.attendance,
                    study_hours=sp.study_hours,
                    latest_predicted_score=latest_rec.predicted_score if latest_rec else None,
                    latest_pass_fail=latest_rec.pass_fail if latest_rec else None,
                    latest_pass_probability=latest_rec.pass_probability if latest_rec else None,
                    latest_risk_level=latest_risk,
                    latest_risk_index=latest_rec.risk_index if latest_rec else None,
                    last_prediction_date=latest_rec.created_at if latest_rec else None,
                )
            )

    total = len(items)
    paginated = items[skip : skip + limit]

    return FacultyStudentListResponse(
        total=total,
        skip=skip,
        limit=limit,
        students=paginated,
    )


@router.get("/students/{id}", response_model=FacultyStudentDetailResponse)
def get_faculty_student_detail(
    id: int,
    current_user: User = Depends(require_role(["faculty"])),
    db: Session = Depends(get_db),
):
    """Retrieve detailed profile for a student. Denies access with 404 if outside faculty's assigned departments."""
    sp = verify_faculty_access_to_student(id, current_user, db)
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
                is_what_if_preview=True,
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


@router.get("/students/{id}/snapshots", response_model=List[DailySnapshotResponse])
def get_faculty_student_snapshots(
    id: int,
    limit: int = Query(60, ge=1, le=365),
    current_user: User = Depends(require_role(["faculty"])),
    db: Session = Depends(get_db),
):
    """Retrieve historical daily snapshots for a student.

    Strictly restricted to students in faculty's assigned departments.
    """
    verify_faculty_access_to_student(id, current_user, db)
    return get_student_snapshots(db=db, student_id=id, limit=limit)


@router.get("/students/{id}/trends", response_model=SnapshotTrendResponse)
def get_faculty_student_trends(
    id: int,
    view_type: str = Query("day", pattern="^(day|week|weekly|month|monthly|year|yearly|semester)$"),
    current_user: User = Depends(require_role(["faculty"])),
    db: Session = Depends(get_db),
):
    """Retrieve aggregated snapshot trends (Weekly, Monthly, Semester) for a student.

    Strictly restricted to students in faculty's assigned departments.
    """
    verify_faculty_access_to_student(id, current_user, db)
    return get_snapshot_trends(db=db, student_id=id, view_type=view_type)


def compute_pearson_r(x_vals: List[float], y_vals: List[float]) -> Optional[float]:
    """Authoritative backend calculation of Pearson correlation coefficient."""
    if len(x_vals) < 2 or len(x_vals) != len(y_vals):
        return None
    try:
        import numpy as np
        arr_x = np.array(x_vals, dtype=float)
        arr_y = np.array(y_vals, dtype=float)
        if np.std(arr_x) == 0 or np.std(arr_y) == 0:
            return None
        r = np.corrcoef(arr_x, arr_y)[0, 1]
        if np.isnan(r):
            return None
        return round(float(r), 4)
    except Exception:
        return None


@router.get("/analytics", response_model=FacultyAnalyticsResponse)
def get_faculty_analytics(
    current_user: User = Depends(require_role(["faculty"])),
    db: Session = Depends(get_db),
):
    """Compute authentic class performance trends and correlations strictly within assigned departments."""
    faculty_depts = get_faculty_assigned_departments(current_user, db)
    assigned_dept_names = [d.name for d in faculty_depts]

    sp_query = filter_students_by_faculty_departments(db.query(StudentProfile), faculty_depts)
    student_profiles = sp_query.all()

    scores = []
    probs = []
    risk_dist = {"LOW": 0, "MODERATE": 0, "HIGH": 0}
    score_dist = {"<40": 0, "40-60": 0, "60-80": 0, "80-100": 0}

    att_scatter: List[ScatterPoint] = []
    study_scatter: List[ScatterPoint] = []
    assign_scatter: List[ScatterPoint] = []

    for sp in student_profiles:
        # Prioritize daily snapshot
        latest_snap = (
            db.query(DailyPredictionSnapshot)
            .filter(DailyPredictionSnapshot.student_id == sp.id)
            .order_by(DailyPredictionSnapshot.snapshot_date.desc())
            .first()
        )
        if latest_snap:
            user = db.query(User).filter(User.id == sp.user_id).first()
            s_name = user.full_name if user else f"Student #{sp.id}"
            r_tier = latest_snap.risk_level.upper()
            score_val = latest_snap.predicted_score

            scores.append(score_val)
            probs.append(latest_snap.pass_probability)
            if r_tier in risk_dist:
                risk_dist[r_tier] += 1
            else:
                risk_dist["LOW"] += 1

            if score_val < 40:
                score_dist["<40"] += 1
            elif score_val < 60:
                score_dist["40-60"] += 1
            elif score_val < 80:
                score_dist["60-80"] += 1
            else:
                score_dist["80-100"] += 1

            att_scatter.append(ScatterPoint(x=latest_snap.attendance, y=score_val, name=s_name, risk_level=r_tier))
            study_scatter.append(ScatterPoint(x=latest_snap.study_hours, y=score_val, name=s_name, risk_level=r_tier))
            assign_scatter.append(ScatterPoint(x=latest_snap.assignments_completed, y=score_val, name=s_name, risk_level=r_tier))
        else:
            latest = (
                db.query(PredictionRecord)
                .filter(PredictionRecord.student_id == sp.id)
                .order_by(PredictionRecord.created_at.desc())
                .first()
            )
            if latest:
                user = db.query(User).filter(User.id == sp.user_id).first()
                s_name = user.full_name if user else f"Student #{sp.id}"
                r_tier = latest.risk_level.upper()
                score_val = latest.predicted_score

                scores.append(score_val)
                probs.append(latest.pass_probability)
                if r_tier in risk_dist:
                    risk_dist[r_tier] += 1
                else:
                    risk_dist["LOW"] += 1

                if score_val < 40:
                    score_dist["<40"] += 1
                elif score_val < 60:
                    score_dist["40-60"] += 1
                elif score_val < 80:
                    score_dist["60-80"] += 1
                else:
                    score_dist["80-100"] += 1

                att_scatter.append(ScatterPoint(x=sp.attendance, y=score_val, name=s_name, risk_level=r_tier))
                study_scatter.append(ScatterPoint(x=sp.study_hours, y=score_val, name=s_name, risk_level=r_tier))
                assign_scatter.append(ScatterPoint(x=sp.assignments_completed, y=score_val, name=s_name, risk_level=r_tier))

    total_preds = len(scores)
    avg_score = round(sum(scores) / total_preds, 2) if total_preds > 0 else None
    avg_prob = round(sum(probs) / total_preds, 4) if total_preds > 0 else None

    correlations = {
        "attendance": compute_pearson_r([p.x for p in att_scatter], [p.y for p in att_scatter]),
        "study_hours": compute_pearson_r([p.x for p in study_scatter], [p.y for p in study_scatter]),
        "assignments": compute_pearson_r([p.x for p in assign_scatter], [p.y for p in assign_scatter]),
    }

    return FacultyAnalyticsResponse(
        total_predictions=total_preds,
        average_predicted_score=avg_score,
        average_pass_probability=avg_prob,
        risk_distribution=risk_dist,
        score_distribution=score_dist,
        attendance_vs_score=att_scatter,
        study_hours_vs_score=study_scatter,
        assignments_vs_score=assign_scatter,
        correlations=correlations,
        assigned_departments=assigned_dept_names,
    )


@router.get("/risk-analysis", response_model=FacultyRiskResponse)
@router.get("/risk-monitor", response_model=FacultyRiskResponse)
def get_faculty_risk_analysis(
    risk_level: Optional[str] = Query(None, description="Optional filter: HIGH or MODERATE"),
    current_user: User = Depends(require_role(["faculty"])),
    db: Session = Depends(get_db),
):
    """Retrieve prioritized list of at-risk students strictly within assigned departments, sorting HIGH risk first."""
    faculty_depts = get_faculty_assigned_departments(current_user, db)
    assigned_dept_names = [d.name for d in faculty_depts]

    sp_query = filter_students_by_faculty_departments(db.query(StudentProfile), faculty_depts)
    student_profiles = sp_query.all()
    risk_items: List[FacultyRiskItem] = []

    high_count = 0
    mod_count = 0

    for sp in student_profiles:
        # Prioritize daily snapshot
        latest_snap = (
            db.query(DailyPredictionSnapshot)
            .filter(DailyPredictionSnapshot.student_id == sp.id)
            .order_by(DailyPredictionSnapshot.snapshot_date.desc())
            .first()
        )
        if latest_snap:
            tier = latest_snap.risk_level.upper()
            if tier == "HIGH":
                high_count += 1
            elif tier == "MODERATE":
                mod_count += 1

            if risk_level and tier != risk_level.upper():
                continue

            user = db.query(User).filter(User.id == sp.user_id).first()
            risk_items.append(
                FacultyRiskItem(
                    student_id=sp.id,
                    full_name=user.full_name if user else f"Student #{sp.id}",
                    roll_number=sp.roll_number,
                    department=sp.department,
                    risk_level=tier,
                    risk_index=latest_snap.risk_index,
                    risk_description=latest_snap.risk_description or "",
                    predicted_score=latest_snap.predicted_score,
                    pass_fail="Pass" if latest_snap.predicted_score >= 40.0 else "Fail",
                    pass_probability=latest_snap.pass_probability,
                    attendance=latest_snap.attendance,
                    study_hours=latest_snap.study_hours,
                    last_prediction_date=latest_snap.created_at,
                )
            )
        else:
            latest = (
                db.query(PredictionRecord)
                .filter(PredictionRecord.student_id == sp.id)
                .order_by(PredictionRecord.created_at.desc())
                .first()
            )
            if latest:
                tier = latest.risk_level.upper()
                if tier == "HIGH":
                    high_count += 1
                elif tier == "MODERATE":
                    mod_count += 1

                if risk_level and tier != risk_level.upper():
                    continue

                user = db.query(User).filter(User.id == sp.user_id).first()
                risk_items.append(
                    FacultyRiskItem(
                        student_id=sp.id,
                        full_name=user.full_name if user else f"Student #{sp.id}",
                        roll_number=sp.roll_number,
                        department=sp.department,
                        risk_level=tier,
                        risk_index=latest.risk_index,
                        risk_description=latest.risk_description or "",
                        predicted_score=latest.predicted_score,
                        pass_fail=latest.pass_fail,
                        pass_probability=latest.pass_probability,
                        attendance=sp.attendance,
                        study_hours=sp.study_hours,
                        last_prediction_date=latest.created_at,
                    )
                )

    priority_order = {"HIGH": 0, "MODERATE": 1, "LOW": 2}
    risk_items.sort(key=lambda item: (priority_order.get(item.risk_level, 3), -item.risk_index))

    return FacultyRiskResponse(
        total_flagged=len(risk_items),
        high_risk_count=high_count,
        moderate_risk_count=mod_count,
        students=risk_items,
        assigned_departments=assigned_dept_names,
    )
