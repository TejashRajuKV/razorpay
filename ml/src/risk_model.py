"""
Revenue Risk Prediction Model
Local sklearn model trained on synthetic data (no external APIs).
Falls back to heuristics if sklearn is unavailable.
"""

import numpy as np

FAILURE_REASONS = [
    'insufficient_funds', 'card_expired', 'transaction_timeout',
    'bank_error', 'declined_by_bank', 'invalid_upi_id',
    'card_limit_exceeded', 'unknown',
]
PAYMENT_METHODS = [
    'credit_card', 'debit_card', 'upi', 'net_banking', 'wallet', 'unknown',
]

FAILURE_RISK_MODIFIERS = {
    'insufficient_funds': 0.15, 'card_expired': 0.35,
    'transaction_timeout': -0.10, 'bank_error': 0.05,
    'declined_by_bank': 0.25, 'invalid_upi_id': 0.40,
    'card_limit_exceeded': 0.20, 'default': 0.10,
}
PAYMENT_METHOD_RISK = {
    'credit_card': 0.3, 'debit_card': 0.4, 'upi': 0.25,
    'net_banking': 0.35, 'wallet': 0.2, 'default': 0.3,
}


def _encode(value, vocabulary):
    try:
        return float(vocabulary.index(value))
    except ValueError:
        return float(len(vocabulary) - 1)


def features_to_vector(features: dict):
    return [
        float(features.get('amount', 0)) / 50000.0,
        _encode(features.get('payment_method', 'unknown'), PAYMENT_METHODS),
        _encode(features.get('failure_reason', 'unknown'), FAILURE_REASONS),
        float(features.get('customer_success_rate', 0.7)),
        float(features.get('customer_total_payments', 1)) / 30.0,
        float(features.get('customer_risk_score', 0.5)),
    ]


def _synthetic_dataset(n=2000, seed=42):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for _ in range(n):
        amount = float(rng.uniform(500, 80000))
        pm = str(rng.choice(PAYMENT_METHODS))
        fr = str(rng.choice(FAILURE_REASONS))
        success_rate = float(rng.uniform(0.05, 1.0))
        total = float(rng.integers(1, 40))
        risk_score = float(rng.uniform(0, 1))
        feats = {
            'amount': amount, 'payment_method': pm, 'failure_reason': fr,
            'customer_success_rate': success_rate,
            'customer_total_payments': total,
            'customer_risk_score': risk_score,
        }
        base = (1.0 - success_rate)
        base += FAILURE_RISK_MODIFIERS.get(fr, 0.10)
        base += PAYMENT_METHOD_RISK.get(pm, 0.3) * 0.1
        base = base * 0.6 + risk_score * 0.4
        label = 1 if base > 0.5 else 0
        if rng.random() < 0.08:
            label = 1 - label
        X.append(features_to_vector(feats))
        y.append(label)
    return np.array(X), np.array(y)


class RiskPredictionModel:
    VERSION = "v2.1.0-calibrated"

    def __init__(self):
        self.is_initialized = False
        self.model = None
        self.sklearn_available = False
        self.eval_metrics = None

    def initialize(self):
        try:
            from sklearn.ensemble import RandomForestClassifier
            from sklearn.calibration import CalibratedClassifierCV
            from sklearn.model_selection import train_test_split
            from sklearn.metrics import (
                accuracy_score, precision_score, recall_score,
                f1_score, roc_auc_score, brier_score_loss,
            )
            X, y = _synthetic_dataset()
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            base_rf = RandomForestClassifier(
                n_estimators=120, max_depth=8, random_state=42, n_jobs=1
            )
            clf = CalibratedClassifierCV(base_rf, method="isotonic", cv=5)
            clf.fit(X_train, y_train)
            proba = clf.predict_proba(X_test)[:, 1]
            pred = (proba >= 0.5).astype(int)
            self.eval_metrics = {
                'accuracy': round(float(accuracy_score(y_test, pred)), 4),
                'precision': round(float(precision_score(y_test, pred, zero_division=0)), 4),
                'recall': round(float(recall_score(y_test, pred, zero_division=0)), 4),
                'f1': round(float(f1_score(y_test, pred, zero_division=0)), 4),
                'roc_auc': round(float(roc_auc_score(y_test, proba)), 4),
                'brier_score': round(float(brier_score_loss(y_test, proba)), 4),
                'test_size': int(len(y_test)),
                'model_version': self.VERSION,
                'note': 'Trained on synthetic data. Metrics are demonstration values only.',
            }
            self.model = clf
            self.sklearn_available = True
        except Exception as e:
            print(f"[RiskModel] sklearn unavailable, heuristic fallback: {e}")
            self.model = None
            self.sklearn_available = False
        self.is_initialized = True
        return self

    def _heuristic(self, features: dict) -> dict:
        amount = features.get('amount', 0)
        payment_method = features.get('payment_method', 'unknown')
        failure_reason = features.get('failure_reason', 'unknown')
        customer_success_rate = features.get('customer_success_rate', 0.7)
        customer_total_payments = features.get('customer_total_payments', 1)
        customer_risk_score = features.get('customer_risk_score', 0.5)
        base_risk = 1.0 - customer_success_rate
        failure_modifier = FAILURE_RISK_MODIFIERS.get(failure_reason, 0.10)
        pm_modifier = PAYMENT_METHOD_RISK.get(payment_method, 0.3) * 0.1
        volume_factor = min(1.0, customer_total_payments / 20)
        volume_modifier = (1.0 - volume_factor) * 0.1
        risk_probability = base_risk + failure_modifier + pm_modifier + volume_modifier
        risk_probability = (risk_probability * 0.6) + (customer_risk_score * 0.4)
        risk_probability = max(0.05, min(0.95, risk_probability))
        factors = []
        if failure_modifier > 0.2:
            factors.append('high_risk_failure_reason')
        if customer_success_rate < 0.6:
            factors.append('poor_payment_history')
        if customer_total_payments < 3:
            factors.append('limited_history')
        if amount > 30000:
            factors.append('high_transaction_amount')
        confidence = 0.6
        if customer_total_payments > 10:
            confidence += 0.15
        elif customer_total_payments > 5:
            confidence += 0.10
        else:
            confidence -= 0.10
        if failure_reason in FAILURE_RISK_MODIFIERS:
            confidence += 0.10
        confidence = min(0.95, confidence)
        return {
            'risk_probability': round(risk_probability, 4),
            'confidence': round(confidence, 4),
            'model_version': 'v1.0.0-heuristic',
            'factors': factors if factors else ['baseline_prediction'],
        }

    def predict(self, features: dict) -> dict:
        if not self.is_initialized:
            self.initialize()
        if self.model is not None:
            try:
                vec = np.array(features_to_vector(features)).reshape(1, -1)
                proba = float(self.model.predict_proba(vec)[0][1])
                factors = []
                if features.get('customer_success_rate', 0.7) < 0.6:
                    factors.append('poor_payment_history')
                if features.get('customer_total_payments', 1) < 3:
                    factors.append('limited_history')
                if float(features.get('amount', 0)) > 30000:
                    factors.append('high_transaction_amount')
                if features.get('failure_reason') in ('invalid_upi_id', 'card_expired'):
                    factors.append('high_risk_failure_reason')
                return {
                    'risk_probability': round(max(0.05, min(0.95, proba)), 4),
                    'confidence': 0.82,
                    'model_version': self.VERSION,
                    'factors': factors if factors else ['model_prediction'],
                }
            except Exception as e:
                print(f"[RiskModel] predict failed, heuristic fallback: {e}")
        return self._heuristic(features)

    def evaluate(self) -> dict:
        if not self.is_initialized:
            self.initialize()
        if self.eval_metrics:
            return dict(self.eval_metrics)
        return {'error': 'sklearn unavailable — no trained evaluation', 'model_version': 'v1.0.0-heuristic'}

    def predict_batch(self, features_list: list) -> list:
        return [self.predict(features) for features in features_list]
