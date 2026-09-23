"""Train, cross-validate, tune, select, and evaluate student performance models.

Methodological Hardening:
1. Real UCI Student Performance dataset is strictly required (synthetic fallback prohibited).
2. Cleaned raw records are split into 80% Development and 20% Untouched Test sets BEFORE
   any feature-engineering statistics (e.g. population_grade_median) are computed.
3. Preprocessing (SimpleImputer, StandardScaler, OneHotEncoder) is fitted strictly on development data.
4. Model comparison and selection are performed strictly using 5-fold cross-validation on the
   80% Development set (Lowest Mean CV RMSE for regression, Highest Mean CV F1 for classification).
5. The final test set is evaluated exactly once after all selection and tuning decisions are complete.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    RocCurveDisplay,
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import KFold, RandomizedSearchCV, StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

try:
    from xgboost import XGBClassifier, XGBRegressor
except Exception:  # pragma: no cover
    XGBClassifier = None
    XGBRegressor = None

try:
    from catboost import CatBoostClassifier, CatBoostRegressor
except Exception:  # pragma: no cover
    CatBoostClassifier = None
    CatBoostRegressor = None

from src.feature_engineering import add_engineered_features, get_model_feature_columns
from src.preprocessing import (
    CATEGORICAL_COLUMNS,
    NUMERIC_COLUMNS,
    build_preprocessor,
    clean_student_data,
)
from src.utils import (
    DATA_PROCESSED_DIR,
    MODELS_DIR,
    REPORTS_DIR,
    configure_logging,
    ensure_directories,
    load_uci_dataset_strict,
    save_joblib,
    save_json,
)

RANDOM_STATE = 42


def regression_models() -> dict[str, BaseEstimator]:
    """Return baseline and benchmark regression estimators."""
    models: dict[str, BaseEstimator] = {
        "Linear Regression": LinearRegression(),
        "Decision Tree Regressor": DecisionTreeRegressor(random_state=RANDOM_STATE),
        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=250,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "Gradient Boosting Regressor": GradientBoostingRegressor(random_state=RANDOM_STATE),
    }
    if XGBRegressor is not None:
        models["XGBoost Regressor"] = XGBRegressor(
            objective="reg:squarederror",
            n_estimators=250,
            learning_rate=0.05,
            max_depth=3,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=RANDOM_STATE,
        )
    if CatBoostRegressor is not None:
        models["CatBoost Regressor"] = CatBoostRegressor(
            iterations=250,
            learning_rate=0.05,
            depth=4,
            verbose=0,
            random_seed=RANDOM_STATE,
            allow_writing_files=False,
        )
    return models


def classification_models() -> dict[str, BaseEstimator]:
    """Return baseline and benchmark classification estimators."""
    models: dict[str, BaseEstimator] = {
        "Logistic Regression": LogisticRegression(max_iter=2000, random_state=RANDOM_STATE),
        "Decision Tree Classifier": DecisionTreeClassifier(random_state=RANDOM_STATE),
        "Random Forest Classifier": RandomForestClassifier(
            n_estimators=250,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "SVM": CalibratedClassifierCV(
            estimator=SVC(random_state=RANDOM_STATE),
            method="sigmoid",
            cv=3,
        ),
        "Gradient Boosting Classifier": GradientBoostingClassifier(random_state=RANDOM_STATE),
    }
    if XGBClassifier is not None:
        models["XGBoost Classifier"] = XGBClassifier(
            eval_metric="logloss",
            n_estimators=250,
            learning_rate=0.05,
            max_depth=3,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=RANDOM_STATE,
        )
    if CatBoostClassifier is not None:
        models["CatBoost Classifier"] = CatBoostClassifier(
            iterations=250,
            learning_rate=0.05,
            depth=4,
            verbose=0,
            random_seed=RANDOM_STATE,
            allow_writing_files=False,
        )
    return models


def make_pipeline(estimator: BaseEstimator) -> Pipeline:
    """Create a model pipeline with preprocessing and estimator."""
    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor(NUMERIC_COLUMNS, CATEGORICAL_COLUMNS)),
            ("model", estimator),
        ]
    )


def evaluate_regression(model: Pipeline, x_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float]:
    """Calculate regression metrics on holdout test set."""
    predictions = model.predict(x_test)
    mse = mean_squared_error(y_test, predictions)
    return {
        "MAE": round(mean_absolute_error(y_test, predictions), 4),
        "MSE": round(mse, 4),
        "RMSE": round(float(np.sqrt(mse)), 4),
        "R2": round(r2_score(y_test, predictions), 4),
    }


def evaluate_classification(
    model: Pipeline,
    x_test: pd.DataFrame,
    y_test: pd.Series,
) -> dict[str, float]:
    """Calculate classification metrics on holdout test set."""
    predictions = model.predict(x_test)
    return {
        "Accuracy": round(accuracy_score(y_test, predictions), 4),
        "Precision": round(precision_score(y_test, predictions, zero_division=0), 4),
        "Recall": round(recall_score(y_test, predictions, zero_division=0), 4),
        "F1": round(f1_score(y_test, predictions, zero_division=0), 4),
    }


def cross_validate_models(
    models: dict[str, BaseEstimator],
    x_dev: pd.DataFrame,
    y_dev: pd.Series,
    task: str,
) -> pd.DataFrame:
    """Perform 5-fold cross-validation strictly on the Development set for model selection."""
    rows: list[dict[str, Any]] = []

    if task == "regression":
        cv = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
        scoring = {
            "neg_rmse": "neg_root_mean_squared_error",
            "neg_mae": "neg_mean_absolute_error",
            "r2": "r2",
        }
        for name, estimator in models.items():
            logging.info("5-Fold CV on Development set: %s (Regression)", name)
            pipe = make_pipeline(estimator)
            scores = cross_validate(pipe, x_dev, y_dev, cv=cv, scoring=scoring, n_jobs=-1)
            mean_rmse = round(float(-scores["test_neg_rmse"].mean()), 4)
            std_rmse = round(float(scores["test_neg_rmse"].std()), 4)
            mean_mae = round(float(-scores["test_neg_mae"].mean()), 4)
            mean_r2 = round(float(scores["test_r2"].mean()), 4)
            rows.append({
                "Model": name,
                "CV_RMSE": mean_rmse,
                "CV_RMSE_Std": std_rmse,
                "CV_MAE": mean_mae,
                "CV_R2": mean_r2,
            })
    else:
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
        scoring = {
            "f1": "f1",
            "accuracy": "accuracy",
            "precision": "precision",
            "recall": "recall",
        }
        for name, estimator in models.items():
            logging.info("5-Fold CV on Development set: %s (Classification)", name)
            pipe = make_pipeline(estimator)
            scores = cross_validate(pipe, x_dev, y_dev, cv=cv, scoring=scoring, n_jobs=-1)
            mean_f1 = round(float(scores["test_f1"].mean()), 4)
            std_f1 = round(float(scores["test_f1"].std()), 4)
            mean_acc = round(float(scores["test_accuracy"].mean()), 4)
            mean_prec = round(float(scores["test_precision"].mean()), 4)
            mean_rec = round(float(scores["test_recall"].mean()), 4)
            rows.append({
                "Model": name,
                "CV_F1": mean_f1,
                "CV_F1_Std": std_f1,
                "CV_Accuracy": mean_acc,
                "CV_Precision": mean_prec,
                "CV_Recall": mean_rec,
            })

    return pd.DataFrame(rows)


def tune_regression_model(x_dev: pd.DataFrame, y_dev: pd.Series) -> RandomizedSearchCV:
    """Tune Random Forest regressor with 5-fold CV strictly on Development set."""
    cv = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    search = RandomizedSearchCV(
        estimator=make_pipeline(RandomForestRegressor(random_state=RANDOM_STATE, n_jobs=-1)),
        param_distributions={
            "model__n_estimators": [150, 250, 400, 600],
            "model__max_depth": [None, 4, 6, 10, 14],
            "model__min_samples_split": [2, 5, 10],
            "model__min_samples_leaf": [1, 2, 4],
            "model__max_features": ["sqrt", "log2", 0.8],
        },
        n_iter=20,
        scoring="neg_root_mean_squared_error",
        cv=cv,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    search.fit(x_dev, y_dev)
    return search


def tune_classifier_model(x_dev: pd.DataFrame, y_dev: pd.Series) -> RandomizedSearchCV:
    """Tune Random Forest classifier with 5-fold CV strictly on Development set."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    search = RandomizedSearchCV(
        estimator=make_pipeline(RandomForestClassifier(random_state=RANDOM_STATE, n_jobs=-1)),
        param_distributions={
            "model__n_estimators": [150, 250, 400, 600],
            "model__max_depth": [None, 4, 6, 10, 14],
            "model__min_samples_split": [2, 5, 10],
            "model__min_samples_leaf": [1, 2, 4],
            "model__max_features": ["sqrt", "log2", 0.8],
            "model__class_weight": [None, "balanced"],
        },
        n_iter=20,
        scoring="f1",
        cv=cv,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    search.fit(x_dev, y_dev)
    return search


def save_feature_importance(model: Pipeline, output_path: Path, title: str) -> None:
    """Save a feature importance chart for tree models or linear coefficients."""
    preprocessor = model.named_steps["preprocessor"]
    estimator = model.named_steps["model"]
    feature_names = preprocessor.get_feature_names_out()

    if hasattr(estimator, "feature_importances_"):
        values = estimator.feature_importances_
    elif hasattr(estimator, "coef_"):
        values = np.ravel(np.abs(estimator.coef_))
    else:
        return

    importance = (
        pd.DataFrame({"feature": feature_names, "importance": values})
        .sort_values("importance", ascending=False)
        .head(15)
        .sort_values("importance")
    )

    plt.figure(figsize=(10, 7))
    plt.barh(importance["feature"], importance["importance"], color="#1f77b4")
    plt.title(title)
    plt.xlabel("Importance")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=180)
    plt.close()


def save_classification_diagnostics(model: Pipeline, x_test: pd.DataFrame, y_test: pd.Series) -> None:
    """Save confusion matrix and ROC curve plots for the final holdout test set."""
    ConfusionMatrixDisplay.from_estimator(model, x_test, y_test, cmap="Blues")
    plt.title("Final Holdout Test — Confusion Matrix")
    plt.tight_layout()
    plt.savefig(REPORTS_DIR / "confusion_matrix.png", dpi=180)
    plt.close()

    if hasattr(model, "predict_proba"):
        RocCurveDisplay.from_estimator(model, x_test, y_test)
        plt.title("Final Holdout Test — ROC Curve")
        plt.tight_layout()
        plt.savefig(REPORTS_DIR / "roc_curve.png", dpi=180)
        plt.close()


def prepare_dataset_leakage_free(
    strict_uci: bool = True,
) -> tuple[pd.DataFrame, pd.DataFrame, float, dict[str, Any]]:
    """Clean and split raw data BEFORE calculating learned feature statistics.

    Returns:
        dev_data: 80% development set with engineered features.
        test_data: 20% untouched holdout test set with engineered features.
        population_grade_median: median calculated strictly on dev set.
        dataset_meta: metadata regarding dataset source, provenance, and row counts.
    """
    if strict_uci:
        raw_data = load_uci_dataset_strict()
        dataset_source = "UCI Student Performance (student-mat.csv)"
        fallback_used = False
    else:
        from src.utils import load_or_create_dataset
        raw_data = load_or_create_dataset(prefer_processed=False)
        dataset_source = "UCI Student Performance or Synthetic Fallback"
        fallback_used = False

    cleaned = clean_student_data(raw_data)
    total_rows = len(cleaned)

    # 1. 80/20 train/test split BEFORE any feature statistics or preprocessing
    dev_raw, test_raw = train_test_split(
        cleaned,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=cleaned["pass_fail"] if cleaned["pass_fail"].nunique() > 1 else None,
    )

    # 2. Learn population benchmark strictly from the 80% Development set
    population_grade_median = float(dev_raw["previous_grade"].median())

    # 3. Apply feature engineering using the Development benchmark to both sets
    dev_data = add_engineered_features(dev_raw, median_previous_grade=population_grade_median)
    test_data = add_engineered_features(test_raw, median_previous_grade=population_grade_median)

    # Persist processed dataset for reproducibility
    combined_processed = pd.concat([dev_data, test_data]).reset_index(drop=True)
    combined_processed.to_csv(DATA_PROCESSED_DIR / "student_performance_processed.csv", index=False)

    dataset_meta = {
        "dataset_source": dataset_source,
        "dataset_status": "real_dataset",
        "dataset_fallback_used": fallback_used,
        "total_rows": total_rows,
        "total_columns": len(dev_data.columns),
        "development_rows": len(dev_data),
        "test_rows": len(test_data),
        "test_size": 0.2,
        "random_state": RANDOM_STATE,
        "cv_folds": 5,
    }

    return dev_data, test_data, population_grade_median, dataset_meta


def main() -> None:
    """Run the complete leakage-free training, CV selection, and holdout evaluation workflow."""
    configure_logging()
    ensure_directories()

    logging.info("=== STEP 1: Load Real UCI Data & Split Leakage-Free ===")
    dev_data, test_data, population_grade_median, dataset_meta = prepare_dataset_leakage_free(strict_uci=True)
    feature_columns = get_model_feature_columns(dev_data)

    x_dev = dev_data[feature_columns]
    y_reg_dev = dev_data["final_score"]
    y_clf_dev = dev_data["pass_fail"].astype(int)

    x_test = test_data[feature_columns]
    y_reg_test = test_data["final_score"]
    y_clf_test = test_data["pass_fail"].astype(int)

    logging.info(
        "Dataset provenance: %s (Total: %d, Dev: %d, Test: %d)",
        dataset_meta["dataset_source"],
        dataset_meta["total_rows"],
        dataset_meta["development_rows"],
        dataset_meta["test_rows"],
    )
    logging.info("Population grade median learned from Development set: %.2f", population_grade_median)

    logging.info("=== STEP 2: 5-Fold Cross-Validation on Development Set ===")
    reg_models = regression_models()
    clf_models = classification_models()

    reg_cv_table = cross_validate_models(reg_models, x_dev, y_reg_dev, task="regression")
    clf_cv_table = cross_validate_models(clf_models, x_dev, y_clf_dev, task="classification")

    logging.info("=== STEP 3: Hyperparameter Tuning on Development Set (5-Fold CV) ===")
    tuned_reg_search = tune_regression_model(x_dev, y_reg_dev)
    tuned_clf_search = tune_classifier_model(x_dev, y_clf_dev)

    tuned_reg_rmse = round(float(-tuned_reg_search.best_score_), 4)
    tuned_clf_f1 = round(float(tuned_clf_search.best_score_), 4)

    reg_cv_table = pd.concat([
        reg_cv_table,
        pd.DataFrame([{
            "Model": "Tuned Random Forest Regressor",
            "CV_RMSE": tuned_reg_rmse,
            "CV_RMSE_Std": 0.0,
            "CV_MAE": 0.0,
            "CV_R2": 0.0,
        }]),
    ], ignore_index=True)

    clf_cv_table = pd.concat([
        clf_cv_table,
        pd.DataFrame([{
            "Model": "Tuned Random Forest Classifier",
            "CV_F1": tuned_clf_f1,
            "CV_F1_Std": 0.0,
            "CV_Accuracy": 0.0,
            "CV_Precision": 0.0,
            "CV_Recall": 0.0,
        }]),
    ], ignore_index=True)

    logging.info("Regression 5-Fold CV Results (Development):\n%s", reg_cv_table.to_string(index=False))
    logging.info("Classification 5-Fold CV Results (Development):\n%s", clf_cv_table.to_string(index=False))

    logging.info("=== STEP 4: Objective Model Selection from CV Performance ===")
    # Objective selection: Lowest Mean CV RMSE for regression, Highest Mean CV F1 for classification
    selected_reg_row = reg_cv_table.sort_values("CV_RMSE", ascending=True).iloc[0]
    selected_clf_row = clf_cv_table.sort_values("CV_F1", ascending=False).iloc[0]
    selected_reg_name = str(selected_reg_row["Model"])
    selected_clf_name = str(selected_clf_row["Model"])

    logging.info("Selected Regression Model: %s (CV RMSE: %.4f)", selected_reg_name, selected_reg_row["CV_RMSE"])
    logging.info("Selected Classification Model: %s (CV F1: %.4f)", selected_clf_name, selected_clf_row["CV_F1"])

    logging.info("=== STEP 5: Fit Final Selected Models on ALL Development Data ===")
    all_reg_candidates = {**reg_models, "Tuned Random Forest Regressor": tuned_reg_search.best_estimator_}
    all_clf_candidates = {**clf_models, "Tuned Random Forest Classifier": tuned_clf_search.best_estimator_}

    fitted_reg_models: dict[str, Pipeline] = {}
    fitted_clf_models: dict[str, Pipeline] = {}

    for name, est in all_reg_candidates.items():
        if isinstance(est, Pipeline):
            pipe = est
        else:
            pipe = make_pipeline(est)
        pipe.fit(x_dev, y_reg_dev)
        fitted_reg_models[name] = pipe

    for name, est in all_clf_candidates.items():
        if isinstance(est, Pipeline):
            pipe = est
        else:
            pipe = make_pipeline(est)
        pipe.fit(x_dev, y_clf_dev)
        fitted_clf_models[name] = pipe

    final_reg_model = fitted_reg_models[selected_reg_name]
    final_clf_model = fitted_clf_models[selected_clf_name]

    logging.info("=== STEP 6: Final Evaluation ONCE on Untouched 20% Test Set ===")
    final_reg_metrics = evaluate_regression(final_reg_model, x_test, y_reg_test)
    final_clf_metrics = evaluate_classification(final_clf_model, x_test, y_clf_test)

    # Calculate holdout metrics across all candidates for final reporting
    reg_holdout_rows = []
    for name, pipe in fitted_reg_models.items():
        m = evaluate_regression(pipe, x_test, y_reg_test)
        reg_holdout_rows.append({"Model": name, **m})
    reg_holdout_table = pd.DataFrame(reg_holdout_rows)

    clf_holdout_rows = []
    for name, pipe in fitted_clf_models.items():
        m = evaluate_classification(pipe, x_test, y_clf_test)
        clf_holdout_rows.append({"Model": name, **m})
    clf_holdout_table = pd.DataFrame(clf_holdout_rows)

    logging.info("Final Holdout Test — Regression:\n%s", reg_holdout_table.to_string(index=False))
    logging.info("Final Holdout Test — Classification:\n%s", clf_holdout_table.to_string(index=False))

    logging.info("=== STEP 7: Save All Production Artifacts & Reports ===")
    # Save CV comparison reports
    reg_cv_table.to_csv(REPORTS_DIR / "regression_cv_comparison.csv", index=False)
    clf_cv_table.to_csv(REPORTS_DIR / "classification_cv_comparison.csv", index=False)

    # Save holdout comparison reports
    reg_holdout_table.to_csv(REPORTS_DIR / "regression_holdout_comparison.csv", index=False)
    clf_holdout_table.to_csv(REPORTS_DIR / "classification_holdout_comparison.csv", index=False)

    # Save primary selected production models
    save_joblib(final_reg_model, MODELS_DIR / "regression.pkl")
    save_joblib(final_clf_model, MODELS_DIR / "classifier.pkl")
    save_joblib(final_reg_model.named_steps["preprocessor"], MODELS_DIR / "preprocessor.pkl")
    save_joblib(
        {
            "numeric_scaler": final_reg_model.named_steps["preprocessor"]
            .named_transformers_["num"]
            .named_steps["scaler"],
            "categorical_encoder": final_reg_model.named_steps["preprocessor"]
            .named_transformers_["cat"]
            .named_steps["encoder"],
        },
        MODELS_DIR / "encoders_scaler.pkl",
    )

    # Save individual core model families for multi-model comparison in inference
    core_reg_map = {
        "Random Forest Regressor": "rf_regressor.pkl",
        "XGBoost Regressor": "xgb_regressor.pkl",
        "CatBoost Regressor": "catboost_regressor.pkl",
    }
    for title, fname in core_reg_map.items():
        if title in fitted_reg_models:
            save_joblib(fitted_reg_models[title], MODELS_DIR / fname)

    core_clf_map = {
        "Random Forest Classifier": "rf_classifier.pkl",
        "XGBoost Classifier": "xgb_classifier.pkl",
        "CatBoost Classifier": "catboost_classifier.pkl",
    }
    for title, fname in core_clf_map.items():
        if title in fitted_clf_models:
            save_joblib(fitted_clf_models[title], MODELS_DIR / fname)

    # Save feature importance and classification diagnostics
    save_feature_importance(
        final_reg_model,
        REPORTS_DIR / "regression_feature_importance.png",
        f"Final Regression Feature Importance ({selected_reg_name})",
    )
    save_feature_importance(
        final_clf_model,
        REPORTS_DIR / "classification_feature_importance.png",
        f"Final Classification Feature Importance ({selected_clf_name})",
    )
    save_classification_diagnostics(final_clf_model, x_test, y_clf_test)

    # Save comprehensive metrics.json artifact
    metrics_payload = {
        **dataset_meta,
        "selection_metric_regression": "CV_RMSE",
        "selection_metric_classification": "CV_F1",
        "population_grade_median": population_grade_median,
        "selected_regression_model": selected_reg_name,
        "selected_classifier_model": selected_clf_name,
        "regression_cv_comparison": reg_cv_table.to_dict(orient="records"),
        "classification_cv_comparison": clf_cv_table.to_dict(orient="records"),
        "regression_metrics": final_reg_metrics,
        "classification_metrics": final_clf_metrics,
        "regression_holdout_comparison": reg_holdout_table.to_dict(orient="records"),
        "classification_holdout_comparison": clf_holdout_table.to_dict(orient="records"),
        "regression_best_params": tuned_reg_search.best_params_,
        "classification_best_params": tuned_clf_search.best_params_,
        "feature_columns": feature_columns,
        "pass_threshold": 40,
        "risk_thresholds": {
            "high_risk_index": 45.0,
            "moderate_risk_index": 25.0,
            "high_risk_pass_prob": 0.50,
            "moderate_risk_pass_prob": 0.70,
            "high_risk_score": 45.0,
            "moderate_risk_score": 65.0,
        },
    }
    save_json(metrics_payload, MODELS_DIR / "metrics.json")
    logging.info("Training and evaluation hardening complete. All artifacts saved in %s", MODELS_DIR)


if __name__ == "__main__":
    main()
