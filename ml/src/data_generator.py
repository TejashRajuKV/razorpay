"""
Synthetic Data Generator — AI Revenue Recovery Agent

Generates deterministic, realistic synthetic payment and customer data
for training and evaluating the local ML models.

Design decisions:
  - Fixed random seed (42) so every run produces identical data.
  - Customer segments follow realistic distributions (70% standard, 20% premium, 10% new).
  - Revenue-risk labels are derived from interpretable business rules, then slightly
    perturbed, so the trained model learns real patterns rather than memorising noise.
  - No PII is generated; all names/emails are clearly synthetic.
"""

import numpy as np
import pandas as pd
from typing import Tuple

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

RANDOM_SEED = 42
N_CUSTOMERS = 500

FAILURE_REASONS = [
    "insufficient_funds",
    "card_expired",
    "transaction_timeout",
    "bank_error",
    "declined_by_bank",
    "invalid_upi_id",
    "card_limit_exceeded",
]

PAYMENT_METHODS = ["credit_card", "debit_card", "upi", "net_banking"]

CUSTOMER_SEGMENTS = ["premium", "standard", "new"]
SEGMENT_WEIGHTS = [0.20, 0.70, 0.10]

DIAGNOSIS_CLASSES = [
    "temporary_failure",
    "repeated_failure",
    "data_issue",
    "abandonment",
]

# Risk modifier per failure reason — used to generate ground-truth labels.
REASON_RISK = {
    "insufficient_funds": 0.55,
    "card_expired": 0.80,
    "transaction_timeout": 0.25,
    "bank_error": 0.35,
    "declined_by_bank": 0.60,
    "invalid_upi_id": 0.75,
    "card_limit_exceeded": 0.50,
}

PRODUCT_CATEGORIES = ["shoes", "shirts", "electronics", "accessories", "home"]

# ─────────────────────────────────────────────
# Customer generator
# ─────────────────────────────────────────────

def generate_customers(n: int, rng: np.random.Generator) -> pd.DataFrame:
    """Return a DataFrame of synthetic customer profiles."""
    segments = rng.choice(CUSTOMER_SEGMENTS, size=n, p=SEGMENT_WEIGHTS)

    # Payment volume correlates with segment.
    base_payments = {"premium": 25, "standard": 10, "new": 3}
    total_payments = np.array([
        max(1, int(rng.normal(base_payments[s], base_payments[s] * 0.3)))
        for s in segments
    ])

    # Success rate correlates with segment and adds realistic noise.
    base_success_rate = {"premium": 0.93, "standard": 0.80, "new": 0.65}
    success_rates = np.clip(
        np.array([rng.normal(base_success_rate[s], 0.08) for s in segments]),
        0.0, 1.0,
    )

    successful_payments = np.maximum(
        0, (total_payments * success_rates).astype(int)
    )
    failed_payments = total_payments - successful_payments

    # Revenue: average order value (AOV) per segment.
    aov_base = {"premium": 15000, "standard": 5000, "new": 2000}
    aovs = np.array([
        max(500, int(rng.normal(aov_base[s], aov_base[s] * 0.25)))
        for s in segments
    ])
    total_revenue = successful_payments * aovs

    # Risk score: inversely correlated with success rate, plus noise.
    risk_scores = np.clip(1.0 - success_rates + rng.normal(0, 0.05, n), 0.02, 0.95)

    # Inactive days (days since last purchase/visit)
    # Higher for some, lower for others to simulate drift
    base_inactive = {"premium": 10, "standard": 25, "new": 45}
    inactive_days = np.array([
        max(0, int(rng.normal(base_inactive[s], base_inactive[s] * 0.5)))
        for s in segments
    ])

    # Preferred categories (1 to 3 categories per customer)
    import json
    preferred_categories = []
    for _ in range(n):
        num_cats = rng.integers(1, 4)
        cats = rng.choice(PRODUCT_CATEGORIES, size=num_cats, replace=False).tolist()
        preferred_categories.append(json.dumps(cats))

    return pd.DataFrame({
        "customer_id": [f"cust_{str(i).zfill(4)}" for i in range(n)],
        "customer_segment": segments,
        "total_payments": total_payments,
        "successful_payments": successful_payments,
        "failed_payments": failed_payments,
        "total_revenue": total_revenue.astype(float),
        "average_order_value": aovs.astype(float),
        "customer_success_rate": success_rates.round(4),
        "risk_score": risk_scores.round(4),
        "inactive_days": inactive_days,
        "preferred_categories": preferred_categories,
    })


# ─────────────────────────────────────────────
# Payment / event generator
# ─────────────────────────────────────────────

def generate_payment_events(
    customers: pd.DataFrame,
    n_events: int,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """Return a DataFrame of synthetic failed/abandoned payment events."""
    # Sample customers proportionally to failed_payments count.
    weights = customers["failed_payments"].clip(lower=1).values.astype(float)
    weights /= weights.sum()

    indices = rng.choice(len(customers), size=n_events, p=weights, replace=True)
    sampled = customers.iloc[indices].reset_index(drop=True)

    failure_reasons = rng.choice(FAILURE_REASONS, size=n_events)
    payment_methods = rng.choice(PAYMENT_METHODS, size=n_events)
    amounts = np.array([
        max(100, int(rng.normal(row["average_order_value"], row["average_order_value"] * 0.3)))
        for _, row in sampled.iterrows()
    ])
    attempt_counts = rng.integers(1, 4, size=n_events)
    days_since_failure = rng.integers(0, 30, size=n_events)

    # Abandoned events (no explicit failure reason).
    is_abandoned = rng.random(n_events) < 0.08
    statuses = np.where(is_abandoned, "abandoned", "failed")
    failure_reasons = np.where(is_abandoned, "checkout_abandonment", failure_reasons)

    return pd.DataFrame({
        "payment_id": [f"pay_{str(i).zfill(5)}" for i in range(n_events)],
        "customer_id": sampled["customer_id"].values,
        "amount": amounts.astype(float),
        "payment_method": payment_methods,
        "failure_reason": failure_reasons,
        "status": statuses,
        "attempt_count": attempt_counts,
        "days_since_failure": days_since_failure,
        "customer_success_rate": sampled["customer_success_rate"].values,
        "customer_total_payments": sampled["total_payments"].values,
        "customer_risk_score": sampled["risk_score"].values,
        "customer_segment": sampled["customer_segment"].values,
        "average_order_value": sampled["average_order_value"].values,
    })


# ─────────────────────────────────────────────
# Label generators (ground truth for supervised learning)
# ─────────────────────────────────────────────

def label_risk(events: pd.DataFrame, rng: np.random.Generator) -> pd.Series:
    """
    Derive continuous risk probability from interpretable business rules,
    then perturb slightly so the model learns a smooth function, not a step function.
    """
    base = 1.0 - events["customer_success_rate"]
    reason_mod = events["failure_reason"].map(REASON_RISK).fillna(0.4)
    volume_mod = (1.0 - (events["customer_total_payments"] / 40).clip(0, 1)) * 0.1

    prob = (base * 0.6 + reason_mod * 0.3 + volume_mod * 0.1)
    noise = rng.normal(0, 0.04, len(events))
    return np.clip(prob + noise, 0.05, 0.95).round(4)


def label_diagnosis(events: pd.DataFrame) -> pd.Series:
    """Map payment features to a discrete diagnosis class."""
    def _diagnose(row):
        if row["status"] == "abandoned":
            return "abandonment"
        if row["failure_reason"] in ("card_expired", "invalid_upi_id"):
            return "data_issue"
        if row["attempt_count"] >= 3 or row["customer_success_rate"] < 0.5:
            return "repeated_failure"
        return "temporary_failure"

    return events.apply(_diagnose, axis=1)


def label_recovery_probability(
    events: pd.DataFrame,
    diagnoses: pd.Series,
    rng: np.random.Generator,
) -> pd.Series:
    """
    Estimate recovery probability per action using the same base-rate table
    as the heuristic RecoveryProbabilityModel, so the sklearn model trains
    on consistent signal.
    """
    base_rates = {
        "temporary_failure": 0.60,
        "repeated_failure": 0.30,
        "data_issue": 0.45,
        "abandonment": 0.40,
    }
    base = diagnoses.map(base_rates).fillna(0.40)
    history_mod = 0.8 + (events["customer_success_rate"] - 0.5) * 0.4
    attempt_pen = (1.0 - (events["attempt_count"] - 1) * 0.15).clip(lower=0.4)

    prob = (base * history_mod * attempt_pen).clip(0.05, 0.90)
    noise = rng.normal(0, 0.03, len(events))
    return np.clip(prob + noise, 0.05, 0.90).round(4)


# ─────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────

def generate_training_data(
    seed: int = RANDOM_SEED,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generate all synthetic training data.

    Returns:
        customers  — 500-row customer profile DataFrame
        events     — 1 500-row labelled payment-event DataFrame
                     (features + risk_prob + diagnosis + recovery_prob)
    """
    rng = np.random.default_rng(seed)
    customers = generate_customers(N_CUSTOMERS, rng)

    # Generate ~3 failed events per customer on average.
    events = generate_payment_events(customers, n_events=N_CUSTOMERS * 3, rng=rng)

    events["risk_probability"] = label_risk(events, rng)
    events["diagnosis"] = label_diagnosis(events)
    events["recovery_probability"] = label_recovery_probability(
        events, events["diagnosis"], rng
    )

    # Binary risk label for classification head (threshold: 0.5).
    events["is_high_risk"] = (events["risk_probability"] >= 0.50).astype(int)

    return customers, events


if __name__ == "__main__":
    customers, events = generate_training_data()
    print(f"Generated {len(customers)} customers and {len(events)} payment events.")
    print("\nRisk probability distribution:")
    print(events["risk_probability"].describe().round(3))
    print("\nDiagnosis class distribution:")
    print(events["diagnosis"].value_counts())
