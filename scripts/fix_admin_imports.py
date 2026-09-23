# -*- coding: utf-8 -*-
admin_path = 'backend/routers/admin.py'
with open(admin_path, 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'from backend.schemas.prediction import PredictionResponse',
    'from backend.schemas.prediction import PredictionResponse, DailySnapshotResponse\nfrom backend.services.snapshot_service import get_student_snapshots'
)

with open(admin_path, 'w', encoding='utf-8') as f:
    f.write(code)
print('Fixed imports in backend/routers/admin.py successfully!')
