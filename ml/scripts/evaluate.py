"""
Model Evaluation Script — AI Revenue Recovery Agent

Loads trained models from ml/models/ and prints a detailed
evaluation report on the held-out test set.

Reports:
  • Risk Model     — classification report, confusion matrix, ROC-AUC
  • Diagnosis      — per-class precision/recall/F1
  • Recovery       — MAE, RMSE, mean absolute percentage error

Run:
  python ml/scripts/evaluate.py
"""

import sys
import os
import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    mean_absolute_error,
    mean_squared_error,
)
from sklearn.model_selection import train_test_split

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, "src"))

from data_generator import generate_training_data  # noqa: E402
from train import build_feature_matrix             # noqa: E402

MODELS_DIR = os.path.join(PROJECT_ROOT, "models")


def load_artifacts():
    """Load persisted models; raise if not found (run train.py first)."""
    paths = {
        "risk": os.path.join(MODELS_DIR, "risk_model.pkl"),
        "diagnosis": os.path.join(MODELS_DIR, "diagnosis_model.pkl"),
        "recovery": os.path.join(MODELS_DIR, "recovery_model.pkl"),
        "encoders": os.path.join(MODELS_DIR, "encoders.pkl"),
    }
    for name, path in paths.items():
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Missing artifact '{name}' at {path}. "
                "Please run `python scripts/train.py` first."
            )
    return {k: joblib.load(v) for k, v in paths.items()}


def main():
    print("=" * 60)
    print("  AI Revenue Recovery — Model Evaluation Report")
    print("=" * 60)

    artifacts = load_artifacts()
    risk_model = artifacts["risk"]
    diag_model = artifacts["diagnosis"]
    rec_model = artifacts["recovery"]
    encoders = artifacts["encoders"]

    # Re-generate exact same data and test split used during training.
    _, events = generate_training_data(seed=42)
    X_all, _ = build_feature_matrix(events, encoders=encoders, fit=False)

    _, X_test, _, idx_test = train_test_split(
        X_all,
        np.arange(len(events)),
        test_size=0.20,
        stratify=events["is_high_risk"].values,
        random_state=42,
    )

    # ── Risk Evaluation ──────────────────────────────────────────────
    print("\n[1/3] RISK MODEL (Binary Classification)")
    print("-" * 60)
    y_true_risk = events["is_high_risk"].values[idx_test]
    y_pred_risk = risk_model.predict(X_test)
    y_prob_risk = risk_model.predict_proba(X_test)[:, 1]

    print(classification_report(
        y_true_risk, y_pred_risk, target_names=["low_risk", "high_risk"]
    ))
    cm = confusion_matrix(y_true_risk, y_pred_risk)
    print(f"  Confusion matrix (rows=actual, cols=predicted):\n{cm}")
    print(f"  ROC-AUC: {roc_auc_score(y_true_risk, y_prob_risk):.4f}")

    # ── Diagnosis Evaluation ─────────────────────────────────────────
    print("\n[2/3] DIAGNOSIS MODEL (Multi-Class Classification)")
    print("-" * 60)
    y_true_diag = events["diagnosis"].values[idx_test]
    y_pred_diag = diag_model.predict(X_test)

    print(classification_report(y_true_diag, y_pred_diag))
    print("  Feature importances (top 5):")
    importances = diag_model.feature_importances_
    from train import NUMERIC_FEATURES, CAT_FEATURES
    feat_names = NUMERIC_FEATURES + [f"{c}_encoded" for c in CAT_FEATURES]
    top5 = sorted(zip(feat_names, importances), key=lambda x: -x[1])[:5]
    for name, score in top5:
        print(f"    {name:<35} {score:.4f}")

    # ── Recovery Evaluation ──────────────────────────────────────────
    print("\n[3/3] RECOVERY PROBABILITY MODEL (Regression)")
    print("-" * 60)
    y_true_rec = events["recovery_probability"].values[idx_test]
    y_pred_rec = np.clip(rec_model.predict(X_test), 0, 1)

    mae = mean_absolute_error(y_true_rec, y_pred_rec)
    rmse = np.sqrt(mean_squared_error(y_true_rec, y_pred_rec))
    mape = np.mean(np.abs((y_true_rec - y_pred_rec) / np.clip(y_true_rec, 0.01, 1))) * 100

    print(f"  MAE:  {mae:.4f}")
    print(f"  RMSE: {rmse:.4f}")
    print(f"  MAPE: {mape:.2f}%")
    print(f"  Predicted range: [{y_pred_rec.min():.3f}, {y_pred_rec.max():.3f}]")

    print("\n" + "=" * 60)
    print("  Evaluation complete.")


if __name__ == "__main__":
    main()
