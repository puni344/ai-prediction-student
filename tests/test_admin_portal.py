import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def get_admin_headers():
    from backend.security import create_access_token
    token = create_access_token({"sub": "admin@institution.edu", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}

class TestAdminOverviewDepartmentFilter:
    def test_overview_all_departments(self):
        headers = get_admin_headers()
        res = client.get("/api/admin/overview", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_students" in data
        assert "total_faculty" in data
        assert "department_performance" in data
        assert len(data["department_performance"]) >= 1

    def test_overview_filter_cse(self):
        headers = get_admin_headers()
        res = client.get("/api/admin/overview?department=Computer Science and Engineering", headers=headers)
        assert res.status_code == 200
        data = res.json()
        dept_perf = data.get("department_performance", [])
        assert len(dept_perf) == 1
        row = dept_perf[0]
        assert "Computer Science" in row["department"]
        assert row["students"] >= 0
        assert row["faculty"] >= 0

    def test_overview_filter_aiml(self):
        headers = get_admin_headers()
        res = client.get("/api/admin/overview?department=Artificial Intelligence and Machine Learning", headers=headers)
        assert res.status_code == 200
        data = res.json()
        dept_perf = data.get("department_performance", [])
        assert len(dept_perf) == 1
        row = dept_perf[0]
        assert "Artificial Intelligence" in row["department"]
        assert row["students"] == 0
        assert row["faculty"] == 0
        assert row["avg_score"] is None
        assert data["total_students"] == 0
        assert data["total_faculty"] == 0

    def test_overview_empty_filter_returns_all(self):
        headers = get_admin_headers()
        res = client.get("/api/admin/overview?department=all", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data["department_performance"]) > 1

class TestAdminCalendar:
    def test_calendar_entries_2026(self):
        headers = get_admin_headers()
        res = client.get("/api/admin/calendar/entries?year=2026", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["year"] == 2026
        assert "entries" in data
        assert isinstance(data["entries"], list)
        assert "total" in data

    def test_calendar_entries_2027(self):
        headers = get_admin_headers()
        res = client.get("/api/admin/calendar/entries?year=2027", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["year"] == 2027
        assert "entries" in data
        assert isinstance(data["entries"], list)

class TestAdminEntityManagement:
    def test_get_admin_students(self):
        headers = get_admin_headers()
        res = client.get("/api/admin/students", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "students" in data
        assert isinstance(data["students"], list)
        assert "total" in data

    def test_get_admin_faculty(self):
        headers = get_admin_headers()
        res = client.get("/api/admin/faculty", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "faculty" in data
        assert isinstance(data["faculty"], list)
        assert "total" in data
