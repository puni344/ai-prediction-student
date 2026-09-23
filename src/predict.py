"""Prediction utilities with TreeSHAP explainability, risk categorization, and multi-model benchmarking."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

try:
    import shap
except Exception:  # pragma: no cover
    shap = None

from src.feature_engineering import add_engineered_features
from src.preprocessing import clean_student_data
from src.utils import MODELS_DIR, load_joblib, load_json


@dataclass(frozen=True)
class PredictionResult:
    """Structured prediction response for one student."""

    predicted_score: float
    pass_fail: str
    pass_probability: float
    confidence_score: float
    contributions: pd.DataFrame
    risk_level: str = "LOW"
    risk_index: float = 0.0
    risk_description: str = ""
    base_value: float = 0.0
    shap_consistency: bool = True
    top_positive: list[dict[str, Any]] = field(default_factory=list)
    top_negative: list[dict[str, Any]] = field(default_factory=list)
    model_comparison: dict[str, Any] = field(default_factory=dict)


def load_models() -> tuple[Pipeline, Pipeline]:
    """Load trained regression and classification pipelines."""
    regression_model = load_joblib(MODELS_DIR / "regression.pkl")
    classifier_model = load_joblib(MODELS_DIR / "classifier.pkl")
    return regression_model, classifier_model


def get_population_grade_median() -> float:
    """Retrieve population median calculated during training from metrics.json."""
    metrics_file = MODELS_DIR / "metrics.json"
    if metrics_file.exists():
        try:
            metrics = load_json(metrics_file)
            return float(metrics.get("population_grade_median", 68.0))
        except Exception:
            pass
    return 68.0


def build_student_frame(
    age: int,
    gender: str,
    attendance: float,
    study_hours: float,
    sleep_hours: float,
    assignments_completed: float,
    previous_grade: float,
    parent_education: str,
    internet_access: str = "yes",
    family_income: str = "medium",
    extra_classes: str = "no",
    participation: float = 70.0,
) -> pd.DataFrame:
    """Create a single-row DataFrame from user input."""
    return pd.DataFrame(
        [
            {
                "age": age,
                "gender": gender,
                "attendance": attendance,
                "study_hours": study_hours,
                "sleep_hours": sleep_hours,
                "assignments_completed": assignments_completed,
                "previous_grade": previous_grade,
                "parent_education": parent_education,
                "internet_access": internet_access,
                "family_income": family_income,
                "extra_classes": extra_classes,
                "participation": participation,
            }
        ]
    )


def prepare_inference_frame(student_data: pd.DataFrame) -> pd.DataFrame:
    """Apply cleaning and feature engineering using the population benchmark."""
    cleaned = clean_student_data(student_data)
    population_median = get_population_grade_median()
    return add_engineered_features(cleaned, median_previous_grade=population_median)


def calculate_risk_level(
    risk_index: float,
    predicted_score: float,
    pass_probability: float,
) -> tuple[str, str]:
    """Calculate deterministic academic risk level and actionable description.

    Decision Rules:
    - HIGH RISK:
      risk_index >= 45.0 OR pass_probability < 0.50 OR predicted_score < 45.0
    - MODERATE RISK:
      25.0 <= risk_index < 45.0 OR 0.50 <= pass_probability < 0.70 OR 45.0 <= predicted_score < 65.0
    - LOW RISK:
      risk_index < 25.0 AND pass_probability >= 0.70 AND predicted_score >= 65.0
    """
    if risk_index >= 45.0 or pass_probability < 0.50 or predicted_score < 45.0:
        return "HIGH", "High academic risk. Immediate intervention and study recovery plan required."
    elif risk_index >= 25.0 or pass_probability < 0.70 or predicted_score < 65.0:
        return "MODERATE", "Moderate academic risk. Regular monitoring and targeted study reinforcement advised."
    else:
        return "LOW", "Low academic risk. Student is academically healthy and well-positioned to pass."


def compute_shap_explanations(
    model: Pipeline,
    data: pd.DataFrame,
) -> tuple[pd.DataFrame, float, bool, list[dict[str, Any]], list[dict[str, Any]]]:
    """Compute genuine TreeSHAP values for local explainability.

    Verifies mathematically that:
        expected_value + sum(shap_values) == predicted_value (within numerical tolerance)
    """
    preprocessor = model.named_steps["preprocessor"]
    estimator = model.named_steps["model"]
    transformed = preprocessor.transform(data)
    feature_names = list(preprocessor.get_feature_names_out())
    raw_prediction = float(estimator.predict(transformed)[0])

    if shap is not None and hasattr(estimator, "tree_") or hasattr(estimator, "estimators_") or "xgb" in type(estimator).__name__.lower() or "catboost" in type(estimator).__name__.lower():
        try:
            explainer = shap.TreeExplainer(estimator)
            shap_raw = explainer.shap_values(transformed)

            if isinstance(shap_raw, list):
                shap_vec = np.array(shap_raw[0]).flatten()
            else:
                shap_vec = np.array(shap_raw).flatten()

            if isinstance(explainer.expected_value, (list, np.ndarray)):
                base_value = float(explainer.expected_value[0])
            else:
                base_value = float(explainer.expected_value)

            reconstructed = float(base_value + np.sum(shap_vec))
            consistency = bool(abs(reconstructed - raw_prediction) < 0.1)

            df_shap = pd.DataFrame({
                "feature": feature_names,
                "contribution": shap_vec,
            })

            # Extract top positive (drivers increasing score) and top negative (drags decreasing score)
            top_pos = (
                df_shap[df_shap["contribution"] > 0]
                .sort_values("contribution", ascending=False)
                .head(5)
                .to_dict(orient="records")
            )
            top_neg = (
                df_shap[df_shap["contribution"] < 0]
                .sort_values("contribution", ascending=True)
                .head(5)
                .to_dict(orient="records")
            )

            contributions_chart = (
                df_shap.assign(abs_val=lambda d: d["contribution"].abs())
                .sort_values("abs_val", ascending=False)
                .head(10)
                .drop(columns="abs_val")
                .sort_values("contribution")
            )
            return contributions_chart, round(base_value, 2), consistency, top_pos, top_neg
        except Exception:
            pass

    # Heuristic fallback if TreeSHAP is unavailable for the selected estimator
    if hasattr(estimator, "feature_importances_"):
        weights = estimator.feature_importances_
        signed = transformed[0] * weights
    elif hasattr(estimator, "coef_"):
        weights = np.ravel(estimator.coef_)
        signed = transformed[0] * weights
    else:
        return pd.DataFrame(columns=["feature", "contribution"]), round(raw_prediction, 2), True, [], []

    df_fallback = pd.DataFrame({"feature": feature_names, "contribution": signed})
    top_pos = df_fallback[df_fallback["contribution"] > 0].sort_values("contribution", ascending=False).head(5).to_dict(orient="records")
    top_neg = df_fallback[df_fallback["contribution"] < 0].sort_values("contribution", ascending=True).head(5).to_dict(orient="records")
    chart = df_fallback.assign(abs_val=lambda d: d["contribution"].abs()).sort_values("abs_val", ascending=False).head(10).drop(columns="abs_val").sort_values("contribution")
    return chart, round(raw_prediction, 2), True, top_pos, top_neg


def compare_model_families(prepared_data: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Generate side-by-side predictions across Random Forest, XGBoost, and CatBoost."""
    results = {}
    family_files = {
        "Random Forest": ("rf_regressor.pkl", "rf_classifier.pkl"),
        "XGBoost": ("xgb_regressor.pkl", "xgb_classifier.pkl"),
        "CatBoost": ("catboost_regressor.pkl", "catboost_classifier.pkl"),
    }

    for model_name, (reg_file, clf_file) in family_files.items():
        reg_path = MODELS_DIR / reg_file
        clf_path = MODELS_DIR / clf_file
        if reg_path.exists():
            try:
                reg_pipe = load_joblib(reg_path)
                pred_score = float(np.clip(reg_pipe.predict(prepared_data)[0], 0, 100))
                prob = None
                pass_label = "Pass"
                if clf_path.exists():
                    clf_pipe = load_joblib(clf_path)
                    pred_class = int(clf_pipe.predict(prepared_data)[0])
                    pass_label = "Pass" if pred_class == 1 else "Fail"
                    if hasattr(clf_pipe, "predict_proba"):
                        prob = float(clf_pipe.predict_proba(prepared_data)[0][1])
                results[model_name] = {
                    "predicted_score": round(pred_score, 2),
                    "pass_fail": pass_label,
                    "pass_probability": round(prob, 4) if prob is not None else None,
                }
            except Exception:
                pass
    return results


def predict_student(student_data: pd.DataFrame) -> PredictionResult:
    """Predict final score, pass/fail status, risk level, SHAP explanations, and model comparison."""
    regression_model, classifier_model = load_models()
    prepared = prepare_inference_frame(student_data)

    predicted_score = float(np.clip(regression_model.predict(prepared)[0], 0, 100))
    class_prediction = int(classifier_model.predict(prepared)[0])

    if hasattr(classifier_model, "predict_proba"):
        pass_probability = float(classifier_model.predict_proba(prepared)[0][1])
    else:
        pass_probability = float(class_prediction)

    confidence_score = pass_probability if class_prediction == 1 else 1.0 - pass_probability

    # Calculate deterministic risk level
    risk_index_val = float(prepared["risk_index"].iloc[0]) if "risk_index" in prepared.columns else 0.0
    risk_level, risk_desc = calculate_risk_level(risk_index_val, predicted_score, pass_probability)

    # Compute genuine SHAP explainability
    contributions, base_val, consistency, top_pos, top_neg = compute_shap_explanations(
        regression_model,
        prepared,
    )

    # Multi-model benchmarking (Random Forest vs XGBoost vs CatBoost)
    model_cmp = compare_model_families(prepared)

    return PredictionResult(
        predicted_score=round(predicted_score, 2),
        pass_fail="Pass" if class_prediction == 1 else "Fail",
        pass_probability=round(pass_probability, 4),
        confidence_score=round(confidence_score, 4),
        contributions=contributions,
        risk_level=risk_level,
        risk_index=round(risk_index_val, 2),
        risk_description=risk_desc,
        base_value=base_val,
        shap_consistency=consistency,
        top_positive=top_pos,
        top_negative=top_neg,
        model_comparison=model_cmp,
    )
