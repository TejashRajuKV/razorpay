"""
ML Training Script — AI Revenue Recovery Agent

Trains three scikit-learn models on synthetic payment data and persists
them with joblib for use by the Flask prediction service.

Models trained:
  1. RiskClassifier      — GradientBoosting: predicts is_high_risk (binary)
  2. DiagnosisClassifier — RandomForest: predicts diagnosis category (4 classes)
  3. RecoveryRegressor   — GradientBoosting: predicts recovery_probability (0..1)

Each model is:
  • Trained on 80 % of data (stratified split, seed=42).
  • Evaluated on the held-out 20 % test set.
  • Saved to ml/models/ for the Flask service to load at startup.

Run:
  python ml/scripts/train.py

from the project root, or:
  python train.py

from the scripts/ directory.
"""

import sys
import os
import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score,
    classification_report, mean_absolute_error,
)

# Allow running from scripts/ OR from project root.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, "src"))

from data_generator import generate_training_data  # noqa: E402
from product_match_model import ProductMatchModel  # noqa: E402

MODELS_DIR = os.path.join(PROJECT_ROOT, "models")
PROCESSED_DIR = os.path.join(PROJECT_ROOT, "data", "processed")

# ─────────────────────────────────────────────
# Feature lists
# ─────────────────────────────────────────────

# Numeric features used by all three models.
NUMERIC_FEATURES = [
    "amount",
    "attempt_count",
    "days_since_failure",
    "customer_success_rate",
    "customer_total_payments",
    "customer_risk_score",
    "average_order_value",
]

# Encoded categoricals.
CAT_FEATURES = ["payment_method", "failure_reason", "customer_segment"]


def build_feature_matrix(df: pd.DataFrame, encoders: dict = None, fit: bool = True) -> np.ndarray:
    """
    Combine numeric and one-hot-encoded categorical features.
    When fit=True, encoders are created and returned; when False, supplied encoders
    are used (for inference on test/prod data).
    """
    numeric_part = df[NUMERIC_FEATURES].fillna(0).values.astype(float)

    cat_parts = []
    if encoders is None:
        encoders = {}

    for col in CAT_FEATURES:
        vals = df[col].fillna("unknown").astype(str)
        if fit:
            le = LabelEncoder()
            encoded = le.fit_transform(vals)
            encoders[col] = le
        else:
            le = encoders[col]
            # Handle unseen labels gracefully.
            known = set(le.classes_)
            vals = vals.map(lambda v: v if v in known else le.classes_[0])
            encoded = le.transform(vals)
        cat_parts.append(encoded.reshape(-1, 1))

    cat_matrix = np.hstack(cat_parts) if cat_parts else np.empty((len(df), 0))
    return np.hstack([numeric_part, cat_matrix]), encoders


# ─────────────────────────────────────────────
# Train helpers
# ─────────────────────────────────────────────

def train_risk_model(X_train, y_train, X_test, y_test):
    """Binary classifier: predicts whether a payment event is high-risk."""
    model = GradientBoostingClassifier(
        n_estimators=150,
        learning_rate=0.08,
        max_depth=4,
        subsample=0.85,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "f1_macro": round(f1_score(y_test, y_pred, average="macro"), 4),
        "roc_auc": round(roc_auc_score(y_test, y_prob), 4),
    }
    return model, metrics


def train_diagnosis_model(X_train, y_train, X_test, y_test):
    """Multi-class classifier: maps payment features → diagnosis category."""
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        min_samples_leaf=4,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "f1_macro": round(f1_score(y_test, y_pred, average="macro"), 4),
        "report": classification_report(y_test, y_pred),
    }
    return model, metrics


def train_recovery_model(X_train, y_train, X_test, y_test):
    """Regression model: predicts recovery probability (0..1)."""
    model = GradientBoostingRegressor(
        n_estimators=150,
        learning_rate=0.08,
        max_depth=4,
        subsample=0.85,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = np.clip(model.predict(X_test), 0, 1)
    metrics = {
        "mae": round(mean_absolute_error(y_test, y_pred), 4),
        "mean_predicted": round(float(y_pred.mean()), 4),
    }
    return model, metrics


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  AI Revenue Recovery — ML Training Pipeline")
    print("=" * 60)

    # 1. Generate / load synthetic data.
    print("\n[1/5] Generating synthetic training data (seed=42)…")
    _, events = generate_training_data(seed=42)
    print(f"      {len(events)} payment events | "
          f"{events['is_high_risk'].mean():.1%} high-risk rate")

    # 2. Build feature matrix (fit encoders on full dataset, then split).
    print("\n[2/5] Engineering features…")
    X_all, encoders = build_feature_matrix(events, fit=True)

    # Stratify on risk label to keep class balance in both splits.
    X_train, X_test, idx_train, idx_test = train_test_split(
        X_all,
        np.arange(len(events)),
        test_size=0.20,
        stratify=events["is_high_risk"].values,
        random_state=42,
    )

    # Shared target arrays.
    y_risk_train = events["is_high_risk"].values[idx_train]
    y_risk_test = events["is_high_risk"].values[idx_test]
    y_diag_train = events["diagnosis"].values[idx_train]
    y_diag_test = events["diagnosis"].values[idx_test]
    y_rec_train = events["recovery_probability"].values[idx_train]
    y_rec_test = events["recovery_probability"].values[idx_test]

    print(f"      Train size: {len(X_train)} | Test size: {len(X_test)}")

    # 3. Train.
    print("\n[3/5] Training models…")

    risk_model, risk_metrics = train_risk_model(X_train, y_risk_train, X_test, y_risk_test)
    print(f"      [Risk]      acc={risk_metrics['accuracy']}  "
          f"f1={risk_metrics['f1_macro']}  roc-auc={risk_metrics['roc_auc']}")

    diag_model, diag_metrics = train_diagnosis_model(X_train, y_diag_train, X_test, y_diag_test)
    print(f"      [Diagnosis] acc={diag_metrics['accuracy']}  "
          f"f1={diag_metrics['f1_macro']}")

    rec_model, rec_metrics = train_recovery_model(X_train, y_rec_train, X_test, y_rec_test)
    print(f"      [Recovery]  mae={rec_metrics['mae']}  "
          f"mean_pred={rec_metrics['mean_predicted']}")

    print("\n[3.5/5] Training Product Match model…")
    customers = pd.DataFrame({
        "inactive_days": events["inactive_days"],
        "preferred_categories": events["preferred_categories"],
        "customer_success_rate": events["customer_success_rate"]
    })
    
    # Generate dummy labels for product match training (higher prob for category match and lower inactive days)
    import json
    def label_product_match(row, cat):
        try:
            cats = json.loads(row["preferred_categories"])
            match = 1.0 if cat in cats else 0.0
        except:
            match = 0.0
        
        base = 0.7 if match else 0.1
        penalty = min(row["inactive_days"] / 100.0, 0.5)
        return max(0.01, base - penalty + np.random.normal(0, 0.05))
        
    y_pm = customers.apply(lambda r: label_product_match(r, "shoes"), axis=1).values
    
    pm_model = ProductMatchModel()
    pm_model.train(customers, "shoes", y_pm)

    # 4. Persist models and encoders.
    print("\n[4/5] Saving model artifacts…")
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    joblib.dump(risk_model, os.path.join(MODELS_DIR, "risk_model.pkl"))
    joblib.dump(diag_model, os.path.join(MODELS_DIR, "diagnosis_model.pkl"))
    joblib.dump(rec_model, os.path.join(MODELS_DIR, "recovery_model.pkl"))
    joblib.dump(pm_model, os.path.join(MODELS_DIR, "product_match_model.pkl"))
    joblib.dump(encoders, os.path.join(MODELS_DIR, "encoders.pkl"))

    # Save processed feature names for documentation.
    feature_names = NUMERIC_FEATURES + [f"{c}_encoded" for c in CAT_FEATURES]
    pd.Series(feature_names).to_csv(
        os.path.join(PROCESSED_DIR, "feature_names.csv"), index=False
    )

    # 5. Print evaluation summary.
    print("\n[5/5] Evaluation summary (held-out 20% test set)")
    print("-" * 60)
    print(f"  Risk Model   — accuracy: {risk_metrics['accuracy']}  "
          f"F1: {risk_metrics['f1_macro']}  AUC: {risk_metrics['roc_auc']}")
    print(f"  Diagnosis    — accuracy: {diag_metrics['accuracy']}  "
          f"F1: {diag_metrics['f1_macro']}")
    print(f"  Recovery     — MAE: {rec_metrics['mae']}")
    print("-" * 60)
    print("\nAll models saved to ml/models/")
    print("Run `python scripts/evaluate.py` for detailed evaluation reports.")


if __name__ == "__main__":
    main()
