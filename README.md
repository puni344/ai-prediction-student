AI-Driven Student Performance Prediction and Personalized Learning Recommendation Using Machine Learning

A full-stack machine-learning platform for student performance prediction, academic risk analysis, explainable predictions, personalized learning recommendations, deterministic timetable planning, and role-based academic monitoring.

1. Project Overview

The platform combines machine learning, deterministic decision logic, explainability, and a web application into a single academic analytics system.

It provides two core ML outputs:

Regression: predicts a student's final score on a 0–100 scale.

Classification: predicts pass/fail status and pass probability.

The prediction layer is integrated with student profiles, historical daily snapshots, recommendations, a constrained 24-hour study planner, an AI academic advisor, faculty analytics, and an administrator portal.

2. System Architecture

Student / Faculty / Admin Browser
              │
              ▼
      React + TypeScript + Vite
              │
              │ HTTPS / JSON API
              ▼
        FastAPI Backend
        ┌──────┼─────────┐
        │      │         │
        ▼      ▼         ▼
      ML     Rules      AI Advisor
   Prediction Engine    Layer
        │      │         │
        └──────┼─────────┘
               ▼
        PostgreSQL Database
               │
               ▼
      Persistent academic data

The backend owns authoritative academic numbers. The AI layer receives verified backend context and provides natural-language guidance; it does not own the prediction, risk, priority, or timetable values.

3. Technology Stack

Frontend

React 19

TypeScript

Vite

Tailwind CSS

React Router

Axios

Recharts

Lucide React

Backend

Python

FastAPI

Pydantic

SQLAlchemy

Uvicorn

Machine Learning

pandas

NumPy

scikit-learn 1.7.2

XGBoost

CatBoost

SHAP

joblib

Database and Integrations

PostgreSQL in deployment

Google Sign-In integration

Read-only Google Calendar integration

Academic calendar integration

Cloudflare Turnstile

Email verification / password reset providers

Gemini-compatible AI provider path

4. Dataset

Source

The current benchmark is trained from the UCI Student Performance dataset, using the student-mat.csv mathematics-course records.

Verified dataset statistics stored in models/metrics.json:

Item

Value

Total records

395

Development records

316

Untouched test records

79

Development/test split

80% / 20%

Total standardized columns

20

Model input features

18

Cross-validation folds

5

Random state

42

Pass threshold

40 / 100

Population grade median used by the saved benchmark

52.5

The final training path uses the real UCI data strictly. The generic utility module still contains an offline synthetic-data helper for development compatibility, but src/train.py uses the strict UCI loader and prohibits synthetic fallback for the final benchmark.

5. Standardized Input Schema

The application standardizes the source data into these fields:

User / source-derived academic and behavioural fields

gender

age

study_hours

attendance

sleep_hours

previous_grade

internet_access

parent_education

family_income

extra_classes

assignments_completed

participation

Engineered model features

study_efficiency

homework_ratio

academic_engagement_score

sleep_quality_index

grade_trend

risk_index

Targets

final_score

pass_fail

The standardized schema therefore contains 18 model features plus the 2 target fields listed above.

6. UCI Feature Mapping

The project does not use the raw UCI columns unchanged. src/utils.py standardizes them into the application schema.

Examples of the mapping include:

Attendance is derived from UCI absences.

Previous grade is derived from G1 and G2.

Final score is derived from G3 and converted from the UCI 0–20 scale to 0–100.

Sleep hours is derived from the UCI health field using the project's deterministic mapping.

Parent education is derived from the average of mother/father education values.

Assignments completed is derived from failures and absences using the project's deterministic formula.

Participation is derived from family relationship, free-time, and going-out variables.

Extra classes is derived from paid classes and school support fields.

Family income is derived from address/family-size rules in the standardization layer.

These transformations are implemented in src/utils.py and the feature engineering layer.

7. Data and Modeling Methodology

The training pipeline in src/train.py follows this sequence:

Load the real UCI dataset.

Standardize the raw UCI schema.

Clean invalid and duplicate records.

Split the data into 80% development and 20% untouched test sets.

Fit learned preprocessing statistics only on the development data.

Generate engineered features.

Compare multiple regression and classification model families using 5-fold cross-validation on the development set.

Tune the selected Random Forest models with RandomizedSearchCV.

Evaluate the final selected models once on the untouched test set.

Persist model, preprocessing, metrics, and comparison artifacts.

This keeps test data separate from model-selection decisions.

8. Models Evaluated

Regression

Linear Regression

Decision Tree Regressor

Random Forest Regressor

Gradient Boosting Regressor

XGBoost Regressor

CatBoost Regressor

Tuned Random Forest Regressor

Classification

Logistic Regression

Decision Tree Classifier

Random Forest Classifier

Support Vector Machine

Gradient Boosting Classifier

XGBoost Classifier

CatBoost Classifier

Tuned Random Forest Classifier

9. Production Models

The current saved production inference artifacts are:

models/regression.pkl → Tuned Random Forest Regressor

models/classifier.pkl → Tuned Random Forest Classifier

Model selection is recorded in models/metrics.json as:

Regression selection metric: 5-fold CV RMSE

Classification selection metric: 5-fold CV F1

The additional Random Forest, XGBoost, and CatBoost artifacts are retained because the runtime also performs model-family comparison for the prediction/results experience.

10. Verified Holdout Results

The following values are recorded in models/metrics.json from the 79-record untouched test set.

Production regression model

Metric

Tuned Random Forest Regressor

MAE

5.6076

MSE

70.5675

RMSE

8.4004

R²

0.8629

Production classification model

Metric

Tuned Random Forest Classifier

Accuracy

92.41%

Precision

92.75%

Recall

98.46%

F1

0.9552

Holdout benchmark comparison

Regression

Model

MAE

RMSE

R²

Linear Regression

7.4967

11.0647

0.7622

Decision Tree Regressor

6.1392

10.5092

0.7855

Random Forest Regressor

5.4359

7.8578

0.8801

Gradient Boosting Regressor

5.6486

7.9396

0.8776

XGBoost Regressor

5.9499

8.1472

0.8711

CatBoost Regressor

5.6474

8.4145

0.8625

Tuned Random Forest Regressor

5.6076

8.4004

0.8629

Classification

Model

Accuracy

Precision

Recall

F1

Logistic Regression

91.14%

91.43%

98.46%

0.9481

Decision Tree Classifier

91.14%

93.94%

95.38%

0.9466

Random Forest Classifier

93.67%

94.12%

98.46%

0.9624

SVM

88.61%

88.89%

98.46%

0.9343

Gradient Boosting Classifier

94.94%

95.52%

98.46%

0.9697

XGBoost Classifier

93.67%

94.12%

98.46%

0.9624

CatBoost Classifier

92.41%

92.75%

98.46%

0.9552

Tuned Random Forest Classifier

92.41%

92.75%

98.46%

0.9552

The production models are selected using development-set cross-validation, while the tables above report the final untouched holdout metrics. Therefore, holdout performance alone should not be used to infer the model-selection rule.

11. Explainable AI with TreeSHAP

The prediction layer uses SHAP TreeExplainer for local explanations of the trained tree model.

For a prediction, the system records:

SHAP feature contributions

positive drivers

negative drivers

the SHAP base value

a mathematical consistency check

The implementation verifies the additive identity:

base_value + sum(SHAP contributions) ≈ model prediction

Recorded verification example:

52.131076 + 39.888924 = 92.020000

The verified TreeSHAP path is used for explainability; a fallback contribution path remains in the code for environments where the TreeSHAP dependency cannot execute.

12. Deterministic Academic Risk Engine

Risk level is assigned by backend rules, not by the LLM.

HIGH

risk_index >= 45.0
OR pass_probability < 0.50
OR predicted_score < 45.0

MODERATE

risk_index >= 25.0
OR pass_probability < 0.70
OR predicted_score < 65.0

LOW

risk_index < 25.0
AND pass_probability >= 0.70
AND predicted_score >= 65.0

The ML models produce the score and pass probability; the deterministic risk engine converts those values into the structured risk category.

13. Personalized Recommendation Engine

Recommendations are generated through a three-layer separation:

ML Model
  ↓
predicted score / probability / SHAP contributions
  ↓
Deterministic Priority Engine
  ↓
priority / tier / duration / candidate selection
  ↓
AI Language Layer
  ↓
summary / title / reason / action

Candidate focus areas include:

attendance

study hours

assignments completed

sleep hours

previous grade

The normalized priority formula is:

P = 0.35U + 0.30I + 0.25W + 0.10(100 - E)

where:

U = urgency

I = model importance

W = weakness

E = effort

Priority tiers are deterministic:

Composite score

Tier

Default duration

>= 70

High

45 minutes

45 to <70

Medium

30 minutes

<45

Low

20 minutes

The LLM does not own these numerical fields.

14. Deterministic 24-Hour Timetable Planner

The timetable engine treats a day as exactly:

24 hours = 1440 minutes

It accounts for:

college hours

breakfast / lunch / dinner

fixed or flexible sleep constraints

Google Calendar busy intervals

study blocks

recovery breaks

holidays and day status

The planner uses interval-union logic so overlapping constraints are not double-counted.

Core invariant:

allocated minutes + remaining minutes = 1440

The implementation also handles schedules crossing midnight and rejects hard constraint conflicts or infeasible requests with explicit validation information.

The study planner is deterministic; the AI advisor only explains a generated schedule and does not modify its times, durations, or ordering.

15. Daily Official Prediction Snapshots

The system maintains an official daily prediction snapshot for each student.

Official snapshot time: 09:00 Asia/Kolkata

One snapshot per student per day

Unique database constraint on (student_id, snapshot_date) prevents duplicates

Existing snapshots are returned unchanged

The next day's snapshot uses the latest persisted student profile

Historical trends aggregate stored snapshots instead of inventing additional predictions

What-if simulations remain separate from official daily snapshots

Student profile changes are persisted immediately, but they do not rewrite an existing official daily snapshot.

16. Student, Faculty, and Admin Portals

Student portal

Includes:

Dashboard

Profile

Prediction

Results

Risk analysis

Explainability

Performance analysis

Progress / history

AI Advisor

Timetable

Settings

Complete-profile flow

Academic calendar integration

Faculty portal

Includes:

Dashboard

Student directory

Student detail view

Performance analysis

Analytics

Risk monitor

Faculty settings

Admin portal

Includes:

Dashboard / overview

Student management

Faculty management

Academic calendar management

Department catalogue access

The current application catalogue contains 18 programs and the source constant defines 27 canonical departments.

17. Authentication and Security Controls

The implemented security layer includes:

JWT bearer authentication

HS256 token signing

bcrypt password hashing

Password-strength validation

Role-based authorization for student, faculty, and admin users

Protected frontend routes

Backend ownership checks for student data

Pydantic request/response validation

Cloudflare Turnstile verification

Email verification

6-digit OTP verification

OTP validity of 5 minutes

Maximum 5 OTP verification attempts

OTP resend cooldown of 60 seconds

In-memory request/rate-limit protection

HTTPS in deployed environments

Server-side storage of provider credentials and API keys

The current source configuration defaults the JWT access-token lifetime to 24 hours; deployed environments can override settings through environment variables.

No claim of absolute security or formal penetration-test certification is made.

18. AI Advisor

The AI advisor is intentionally separated from authoritative ML and scheduling logic.

Authoritative layer

Owns:

predicted score

pass probability

pass/fail

confidence

risk level

risk index

SHAP values

recommendation priority

recommendation duration

timetable start/end times

timetable ordering

AI language layer

Provides:

explanations

recommendation wording

concise summaries

conversational academic guidance

explanation of deterministic study plans

The repository contains a provider abstraction with:

AIInferenceClient

development/mock client

live Gemini-compatible client

A recorded Phase 5 verification report documents successful live gemini-2.5-flash execution, grounded recommendation generation, chat responses, prompt-injection resistance checks, missing-data behaviour, and deterministic fallback handling.

19. Calendar Integrations

The application supports an academic calendar resolution layer and student calendar constraints.

The Google Calendar integration uses a read-only calendar scope and is used to retrieve busy periods for timetable planning. It does not create, update, or delete Google Calendar events.

The academic calendar layer also supports institution and student overrides and regional calendar data.

20. Backend API Surface

The FastAPI application exposes route groups for:

Authentication

Student profiles and catalogues

Predictions and historical snapshots

Faculty dashboards and analytics

Recommendations

AI advisor chat

Timetable generation / validation

Academic calendar operations

Administrator operations

Health/readiness probes

System clock and configuration diagnostics

Interactive API documentation is available from FastAPI at /api/docs in a running deployment.

21. Repository Structure

.
├── backend/
│   ├── ai/
│   ├── constants/
│   ├── models/
│   ├── routers/
│   ├── schemas/
│   └── services/
├── data/
│   ├── raw/
│   └── processed/
├── docs/
│   └── AI_ARCHITECTURE.md
├── frontend/
│   ├── public/
│   └── src/
├── models/
│   ├── regression.pkl
│   ├── classifier.pkl
│   ├── rf_regressor.pkl
│   ├── rf_classifier.pkl
│   ├── xgb_regressor.pkl
│   ├── xgb_classifier.pkl
│   ├── catboost_regressor.pkl
│   ├── catboost_classifier.pkl
│   ├── preprocessor.pkl
│   ├── encoders_scaler.pkl
│   └── metrics.json
├── reports/
│   └── figures/
├── screenshots/
├── src/
│   ├── feature_engineering.py
│   ├── predict.py
│   ├── preprocessing.py
│   ├── train.py
│   └── utils.py
├── tests/
├── .gitignore
├── LICENSE
├── pyproject.toml
├── requirements.txt
└── README.md

22. Important Model Artifacts

Artifact

Purpose

models/regression.pkl

Production regression pipeline

models/classifier.pkl

Production classification pipeline

models/rf_regressor.pkl

Random Forest comparison model

models/rf_classifier.pkl

Random Forest comparison model

models/xgb_regressor.pkl

XGBoost comparison model

models/xgb_classifier.pkl

XGBoost comparison model

models/catboost_regressor.pkl

CatBoost comparison model

models/catboost_classifier.pkl

CatBoost comparison model

models/preprocessor.pkl

Saved preprocessing artifact

models/encoders_scaler.pkl

Saved preprocessing compatibility artifact

models/metrics.json

Dataset metadata, model selection, metrics and thresholds

23. Local Setup

Backend

Create and activate a Python virtual environment, then install dependencies:

python -m venv .venv

Windows PowerShell:

.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Linux/macOS:

source .venv/bin/activate
pip install -r requirements.txt

Configure the environment variables required by the deployment mode, especially:

DATABASE_URL
SECRET_KEY
APP_ENV
CORS_ORIGINS
AI_PROVIDER
AI_MODEL
AI_API_KEY
AI_BASE_URL
EMAIL_PROVIDER
BREVO_API_KEY / SMTP settings
TURNSTILE settings
GOOGLE OAuth settings (when enabled)
CALENDARIFIC settings (when enabled)

Never commit .env, provider credentials, JWT secrets, database passwords, or API keys.

Run the backend:

uvicorn backend.main:app --reload

Frontend

cd frontend
npm install
npm run dev

The frontend reads the API base URL from VITE_API_URL.

24. Training

The current strict training pipeline can be run with:

python -m src.train

It downloads/loads the real UCI Student Performance dataset, performs the leakage-controlled development/test split, performs cross-validation and tuning, evaluates the untouched holdout set, and writes the model/metric/comparison artifacts under models/ and reports/figures/.

25. Testing and Verification Evidence

The repository contains regression/security/integration tests covering areas such as:

authentication and role isolation

student profile constraints

prediction flow and provenance

result loading

timetable constraints and 24-hour invariants

email/OTP lifecycle

Turnstile lifecycle

academic-calendar integration

faculty/admin portal behaviour

A recorded Phase 5 runtime verification report included in the repository documents a previous run with 21 passed tests and 0 failures plus a successful frontend production build. That report is historical evidence of the verification run; exact results depend on the environment and configuration used for the current checkout.

26. Deployment

The deployed architecture is:

Vercel
  React frontend
      │
      ▼
Render
  FastAPI backend
      │
      ▼
Render PostgreSQL

Known production endpoints:

Frontend: https://ai-prediction-student.vercel.app

Backend: https://student-performance-api-wsh5.onrender.com

API docs: https://student-performance-api-wsh5.onrender.com/api/docs

Production backend start command:

uvicorn backend.main:app --host 0.0.0.0 --port $PORT

Production frontend API configuration:

VITE_API_URL=https://student-performance-api-wsh5.onrender.com/api

27. Design Principle

The core architectural rule is:

ML decides the numbers. Deterministic logic decides structured actions. AI explains and communicates.

This separation keeps prediction outputs, risk classifications, recommendation priorities, and timetable constraints authoritative and reproducible.

28. Limitations

The benchmark dataset contains 395 records from the UCI mathematics-course dataset; it is not a universal representation of every institution or curriculum.

Several application-level variables are standardized/derived from UCI source fields rather than being directly measured in the raw dataset.

The current application predicts overall academic performance; it does not provide subject-level prediction from a multi-subject institutional dataset.

A formal large-scale concurrency/load-capacity benchmark is not included in the repository.

No claim of formal penetration-test certification or absolute security is made.

The live AI provider is an external dependency; deterministic fallback behaviour remains available when the live provider is unavailable.

29. License

MIT License. See LICENSE.

30. Author

Puneeth Reddy
