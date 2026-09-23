# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.abspath('.'))

from backend.database import SessionLocal
from backend.models.user import User
from backend.ai.context_builder import build_student_ai_context
from backend.ai.client import DevelopmentMockAIClient

db = SessionLocal()
student = db.query(User).filter(User.email == 'final.audit.student@institution.edu').first()
context = build_student_ai_context(db, student)

client = DevelopmentMockAIClient()

capabilities = [
    "PREDICTED_PERFORMANCE",
    "WHY_PREDICTION",
    "RISK_FACTORS",
    "WHAT_TO_IMPROVE",
    "EXPLAIN_SHAP",
    "RECOMMENDATION_METHOD",
]

forbidden_phrases = [
    "guarantees low risk",
    "directly boosts",
    "produce the highest academic gain",
    "above 85% guarantees",
]

print("="*80)
print("AUDIT OF ALL SIX AI ADVISOR RESPONSES")
print("="*80)

all_passed = True
for cap in capabilities:
    ans = client.chat_answer("", [], context, capability=cap)
    print(f"\n--- Capability: {cap} ---")
    print(ans)
    
    # Check forbidden
    has_forbidden = False
    for fp in forbidden_phrases:
        if fp.lower() in ans.lower():
            print(f"FAILED: Contains forbidden phrase '{fp}'")
            has_forbidden = True
            all_passed = False
    if not has_forbidden:
        print("PASS: No unsupported causal/guarantee language detected.")

print("\n" + "="*80)
print(f"ALL SIX AI RESPONSES AUDIT: {'PASS' if all_passed else 'FAIL'}")
print("="*80)

db.close()
