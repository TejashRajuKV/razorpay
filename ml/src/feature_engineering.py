"""
Feature Engineering Module for AI Revenue Recovery Agent.

Responsible for feature extraction, categorical encoding, temporal feature derivation,
and preprocessing pipelines for payment failure diagnosis and recovery probability modeling.
"""

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer


# Canonical Diagnosis Categories
DIAGNOSIS_CLASSES = [
    "TEMPORARY_GATEWAY_DOWNTIME",
    "INSUFFICIENT_FUNDS",
    "EXPIRED_OR_INVALID_INSTRUMENT",
    "CHECKOUT_FRICTION_ABANDONMENT",
    "AUTHENTICATION_3DS_DROPOUT",
    "SUSPICIOUS_VELOCITY_RISK",
    "OVERDUE_INVOICE_NEGLECT"
]

# Candidate Recovery Action Types
RECOVERY_ACTIONS = [
    "RETRY_IMMEDIATE",
    "RETRY_OPTIMAL_WINDOW",
    "SEND_SMART_PAYMENT_LINK",
    "SEND_WHATSAPP_REMINDER",
    "SWITCH_PAYMENT_METHOD",
    "ESCALATE_HUMAN_REVIEW",
    "STOP_RECOVERY"
]

# Payment Methods supported
PAYMENT_METHODS = ["UPI", "CREDIT_CARD", "DEBIT_CARD", "NETBANKING", "SUBSCRIPTION_AUTOPAY", "INVOICE"]

# Core numerical & categorical features
NUMERICAL_FEATURES = [
    "amount",
    "customer_lifetime_value",
    "customer_past_success_rate",
    "customer_past_failures_count",
    "days_since_last_success",
    "hour_of_day",
    "day_of_week",
    "is_month_end_payday",
    "attempt_number",
    "checkout_dwell_time_seconds",
    "time_since_failure_minutes"
]

CATEGORICAL_FEATURES = [
    "payment_method",
    "bank_network",
    "error_code_category",
    "customer_risk_tier"
]


def extract_features_from_dict(event: Dict[str, Any]) -> pd.DataFrame:
    """
    Extracts and standardizes raw payment/event dictionary into a single-row DataFrame.
    """
    row = {
        "amount": float(event.get("amount", 1000.0)),
        "customer_lifetime_value": float(event.get("customer_lifetime_value", 5000.0)),
        "customer_past_success_rate": float(event.get("customer_past_success_rate", 0.85)),
        "customer_past_failures_count": int(event.get("customer_past_failures_count", 0)),
        "days_since_last_success": float(event.get("days_since_last_success", 5.0)),
        "hour_of_day": int(event.get("hour_of_day", 14)),
        "day_of_week": int(event.get("day_of_week", 2)),
        "is_month_end_payday": int(event.get("is_month_end_payday", 0)),
        "attempt_number": int(event.get("attempt_number", 1)),
        "checkout_dwell_time_seconds": float(event.get("checkout_dwell_time_seconds", 45.0)),
        "time_since_failure_minutes": float(event.get("time_since_failure_minutes", 10.0)),
        "payment_method": str(event.get("payment_method", "UPI")),
        "bank_network": str(event.get("bank_network", "HDFC")),
        "error_code_category": str(event.get("error_code_category", "GATEWAY_TIMEOUT")),
        "customer_risk_tier": str(event.get("customer_risk_tier", "LOW"))
    }
    return pd.DataFrame([row])


def build_preprocessor() -> ColumnTransformer:
    """
    Builds a ColumnTransformer that normalizes numerical values and one-hot encodes categoricals.
    """
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERICAL_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES)
        ],
        remainder="drop"
    )
    return preprocessor
