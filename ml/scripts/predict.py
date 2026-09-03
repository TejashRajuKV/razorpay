"""
Prediction CLI — AI Revenue Recovery Agent

Single-case prediction utility for quick debugging outside the Flask service.
Loads trained model artifacts and accepts feature values as JSON via stdin or CLI args.

Usage:
  python ml/scripts/predict.py --amount 25000 --method upi --reason transaction_timeout \
      --success_rate 0.92 --total_payments 15 --risk_score 0.12 \
      --segment premium --attempt_count 1 --days_since_failure 0 --aov 20000

Output (JSON):
  {
    "risk_probability": 0.23,
    "risk_level": "LOW",
    "diagnosis": "temporary_failure",
    "diagnosis_confidence": 0.88,
    "recovery_probability": 0.71
  }
"""

import sys
import os
import argparse
import json
import joblib
import numpy as np

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, "src"))

from train import build_feature_matrix, NUMERIC_FEATURES, CAT_FEATURES  # noqa: E402

MODELS_DIR = os.path.join(PROJECT_ROOT, "models")

RISK_THRESHOLDS = {"LOW": 0.40, "MEDIUM": 0.65, "HIGH": 1.01}


def classify_risk_level(prob: float) -> str:
    for level, upper in RISK_THRESHOLDS.items():
        if prob < upper:
            return level
    return "HIGH"


def predict(features: dict) -> dict:
    """Run all three models on a single feature dict and return combined output."""
    risk_model = joblib.load(os.path.join(MODELS_DIR, "risk_model.pkl"))
    diag_model = joblib.load(os.path.join(MODELS_DIR, "diagnosis_model.pkl"))
    rec_model = joblib.load(os.path.join(MODELS_DIR, "recovery_model.pkl"))
    encoders = joblib.load(os.path.join(MODELS_DIR, "encoders.pkl"))

    # Build a single-row DataFrame matching training schema.
    row = {
        "amount": float(features.get("amount", 5000)),
        "attempt_count": int(features.get("attempt_count", 1)),
        "days_since_failure": int(features.get("days_since_failure", 0)),
        "customer_success_rate": float(features.get("success_rate", 0.80)),
        "customer_total_payments": int(features.get("total_payments", 10)),
        "customer_risk_score": float(features.get("risk_score", 0.20)),
        "average_order_value": float(features.get("aov", 5000)),
        "payment_method": str(features.get("method", "upi")),
        "failure_reason": str(features.get("reason", "transaction_timeout")),
        "customer_segment": str(features.get("segment", "standard")),
    }

    import pandas as pd
    df = pd.DataFrame([row])
    X, _ = build_feature_matrix(df, encoders=encoders, fit=False)

    risk_prob = float(risk_model.predict_proba(X)[0][1])
    diagnosis = str(diag_model.predict(X)[0])
    diag_probs = diag_model.predict_proba(X)[0]
    diag_confidence = float(np.max(diag_probs))
    rec_prob = float(np.clip(rec_model.predict(X)[0], 0.05, 0.95))

    return {
        "risk_probability": round(risk_prob, 4),
        "risk_level": classify_risk_level(risk_prob),
        "diagnosis": diagnosis,
        "diagnosis_confidence": round(diag_confidence, 4),
        "recovery_probability": round(rec_prob, 4),
    }


def main():
    parser = argparse.ArgumentParser(description="Single-case revenue-risk prediction")
    parser.add_argument("--amount", type=float, default=5000)
    parser.add_argument("--method", type=str, default="upi")
    parser.add_argument("--reason", type=str, default="transaction_timeout")
    parser.add_argument("--success_rate", type=float, default=0.80)
    parser.add_argument("--total_payments", type=int, default=10)
    parser.add_argument("--risk_score", type=float, default=0.20)
    parser.add_argument("--segment", type=str, default="standard")
    parser.add_argument("--attempt_count", type=int, default=1)
    parser.add_argument("--days_since_failure", type=int, default=0)
    parser.add_argument("--aov", type=float, default=5000)
    args = parser.parse_args()

    result = predict(vars(args))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
