"""Database seeding service for departments, existing profile mapping, and main admin account."""
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.database import engine, Base
from backend.models.department import Department, FacultyDepartment
from backend.models.profile import StudentProfile, FacultyProfile
from backend.models.user import User
from backend.constants.departments import DEPARTMENTS, validate_and_normalize_department
from backend.security import get_password_hash
from backend.config import settings

logger = logging.getLogger(__name__)


def seed_departments_and_admin(db: Session) -> None:
    """Ensure database schema is up-to-date, departments seeded, profiles mapped, and admin created."""
    # 1. Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    # 2. Check if student_profiles.department_id column exists; if not, add it
    with engine.connect() as conn:
        res = conn.execute(text("PRAGMA table_info(student_profiles);"))
        col_names = [row[1] for row in res.fetchall()]
        if "department_id" not in col_names:
            conn.execute(text("ALTER TABLE student_profiles ADD COLUMN department_id INTEGER REFERENCES departments(id);"))
            conn.commit()
            logger.info("Added department_id column to student_profiles.")

    # 3. Seed 27 canonical departments
    dept_map = {}
    for item in DEPARTMENTS:
        code = item["id"].lower()
        name = item["name"]
        dept = db.query(Department).filter((Department.code == code) | (Department.name == name)).first()
        if not dept:
            dept = Department(code=code, name=name, is_active=True)
            db.add(dept)
            db.flush()
        dept_map[name.lower()] = dept
        dept_map[code] = dept
    db.commit()

    # 4. Map existing student profiles
    unmapped_students = db.query(StudentProfile).filter(StudentProfile.department_id.is_(None)).all()
    for sp in unmapped_students:
        raw_dept = sp.department or "Computer Science and Engineering"
        normalized = validate_and_normalize_department(raw_dept) or "Computer Science and Engineering"
        dept_obj = dept_map.get(normalized.lower())
        if not dept_obj:
            dept_obj = db.query(Department).filter(Department.name == normalized).first()
        if dept_obj:
            sp.department_id = dept_obj.id
            sp.department = dept_obj.name
    db.commit()

    # 5. Map existing faculty profiles
    faculty_profiles = db.query(FacultyProfile).all()
    for fp in faculty_profiles:
        if not fp.faculty_id:
            fp.faculty_id = f"EMP-{fp.id:04d}"
        
        # Check if faculty has any departments in association table
        existing_depts = db.query(FacultyDepartment).filter(FacultyDepartment.faculty_profile_id == fp.id).all()
        if not existing_depts:
            raw_dept = fp.department or "Computer Science and Engineering"
            normalized = validate_and_normalize_department(raw_dept) or "Computer Science and Engineering"
            dept_obj = dept_map.get(normalized.lower())
            if not dept_obj:
                dept_obj = db.query(Department).filter(Department.name == normalized).first()
            if dept_obj:
                fd = FacultyDepartment(faculty_profile_id=fp.id, department_id=dept_obj.id)
                db.add(fd)
                fp.department = dept_obj.name
    db.commit()

    # 6. Verify admin account exists (admin is created by deployment reset script, not seed)
    admin_user = db.query(User).filter(User.role == "admin").first()
    if admin_user:
        logger.info(f"Administrator account exists: {admin_user.email}")
        # Enforce that only one admin exists
        other_admins = db.query(User).filter(User.role == "admin", User.id != admin_user.id).all()
        for oa in other_admins:
            oa.role = "faculty"
        db.commit()
    else:
        logger.warning(
            "No administrator account found. "
            "Run the deployment reset script to create the admin account."
        )
