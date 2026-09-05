"""
Diagnosis Model - Root Cause Classification
Local sklearn classifier trained on synthetic data (no external APIs).
Falls back to rules if sklearn is unavailable.
Categories (India-specific): network_timeout, insufficient_funds, card_expired,
upi_pin_error, bank_decline, abandoned, data_error
"""

import numpy as np

CATEGORIES = [
    'network_timeout',
    'insufficient_funds',
    'card_expired',
    'upi_pin_error',
    'bank_decline',
    'abandoned',
    'data_error',
]

CATEGORY_TO_ACTION = {
    'network_timeout': {'action': 'retry', 'wait_min': 5},
    'insufficient_funds': {'action': 'reminder', 'wait_min': 1440},
    'card_expired': {'action': 'payment_link', 'wait_min': 30},
    'upi_pin_error': {'action': 'reminder', 'wait_min': 60},
    'bank_decline': {'action': 'retry_later', 'wait_min': 360},
    'abandoned': {'action': 'payment_link', 'wait_min': 120},
    'data_error': {'action': 'escalate', 'wait_min': 0},
}

FAILURE_REASONS = [
    'insufficient_funds', 'card_expired', 'transaction_timeout',
    'bank_error', 'declined_by_bank', 'invalid_upi_id',
    'card_limit_exceeded', 'unknown',
    # appended last so existing vocabulary indices stay stable
    'checkout_abandoned',
]

REASON_DIAGNOSIS_MAP = {
    'insufficient_funds': 'insufficient_funds',
    'card_limit_exceeded': 'insufficient_funds',
    'transaction_timeout': 'network_timeout',
    'bank_error': 'network_timeout',
    'card_expired': 'card_expired',
    'invalid_upi_id': 'upi_pin_error',
    'declined_by_bank': 'bank_decline',
    'checkout_abandoned': 'abandoned',
}


def _encode(value, vocabulary):
    try:
        return float(vocabulary.index(value))
    except ValueError:
        return float(len(vocabulary) - 1)


def features_to_vector(features: dict):
    return [
        _encode(features.get('failure_reason', 'unknown'), FAILURE_REASONS),
        float(features.get('attempt_count', 1)) / 5.0,
        float(features.get('customer_success_rate', 0.7)),
        float(features.get('customer_total_payments', 1)) / 30.0,
        1.0 if features.get('payment_status') == 'abandoned' else 0.0,
        float(features.get('days_since_failure', 0)) / 30.0,
    ]


def _synthetic_dataset(n=2400, seed=7):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for _ in range(n):
        fr = str(rng.choice(FAILURE_REASONS))
        attempts = int(rng.integers(1, 6))
        success_rate = float(rng.uniform(0.05, 1.0))
        total = float(rng.integers(1, 40))
        abandoned = bool(rng.random() < 0.12)
        days = float(rng.uniform(0, 20))
        if abandoned:
            label = 'abandoned'
        elif fr in ('card_expired',):
            label = 'card_expired'
        elif fr in ('invalid_upi_id',):
            label = 'upi_pin_error'
        elif attempts >= 3 or (success_rate < 0.5 and total > 3):
            label = 'bank_decline'
        else:
            label = REASON_DIAGNOSIS_MAP.get(fr, 'network_timeout')
            if label not in CATEGORIES:
                label = 'data_error'
        if rng.random() < 0.07:
            label = str(rng.choice(CATEGORIES))
        feats = {
            'failure_reason': fr, 'attempt_count': attempts,
            'customer_success_rate': success_rate,
            'customer_total_payments': total,
            'payment_status': 'abandoned' if abandoned else 'failed',
            'days_since_failure': days,
        }
        X.append(features_to_vector(feats))
        y.append(CATEGORIES.index(label))
    return np.array(X), np.array(y)


class DiagnosisModel:
    VERSION = "v2.0.0-sklearn"
    CATEGORIES = CATEGORIES
    REASON_DIAGNOSIS_MAP = REASON_DIAGNOSIS_MAP

    def __init__(self):
        self.is_initialized = False
        self.model = None
        self.eval_metrics = None

    def initialize(self):
        try:
            from sklearn.ensemble import RandomForestClassifier
            from sklearn.model_selection import train_test_split
            from sklearn.metrics import accuracy_score, f1_score
            X, y = _synthetic_dataset()
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=7, stratify=y
            )
            clf = RandomForestClassifier(n_estimators=120, max_depth=9, random_state=7, n_jobs=1)
            clf.fit(X_train, y_train)
            pred = clf.predict(X_test)
            self.eval_metrics = {
                'accuracy': round(float(accuracy_score(y_test, pred)), 4),
                'f1_macro': round(float(f1_score(y_test, pred, average='macro', zero_division=0)), 4),
                'test_size': int(len(y_test)),
                'model_version': self.VERSION,
            }
            self.model = clf
        except Exception as e:
            print(f"[DiagnosisModel] sklearn unavailable, rule fallback: {e}")
            self.model = None
        self.is_initialized = True
        return self

    def _rule_predict(self, features: dict) -> dict:
        failure_reason = features.get('failure_reason', 'unknown')
        attempt_count = features.get('attempt_count', 1)
        customer_success_rate = features.get('customer_success_rate', 0.7)
        customer_total_payments = features.get('customer_total_payments', 1)
        payment_status = features.get('payment_status', 'failed')
        days_since_failure = features.get('days_since_failure', 0)
        diagnosis = REASON_DIAGNOSIS_MAP.get(failure_reason, 'data_error')
        confidence = 0.65
        factors = ['failure_reason_match']
        if attempt_count >= 3 or (customer_success_rate < 0.5 and customer_total_payments > 3):
            diagnosis = 'bank_decline'
            confidence = max(confidence, 0.75)
            factors.append('repeated_pattern_detected')
        if payment_status == 'abandoned':
            diagnosis = 'abandoned'
            confidence = 0.85
            factors = ['checkout_abandonment']
        if diagnosis in ('data_error', 'card_expired'):
            confidence = max(confidence, 0.85)
        if days_since_failure > 7 and diagnosis == 'network_timeout':
            diagnosis = 'bank_decline'
            factors.append('time_decay')
        alternatives = [
            {'diagnosis': c, 'probability': 0.2 if c != diagnosis else 0.0}
            for c in CATEGORIES if c != diagnosis
        ][:2]
        return {
            'diagnosis': diagnosis,
            'confidence': round(min(0.95, confidence), 4),
            'model_version': 'v1.0.0-heuristic',
            'factors': factors,
            'alternatives': alternatives,
        }

    def predict(self, features: dict) -> dict:
        if not self.is_initialized:
            self.initialize()
        if self.model is not None:
            try:
                vec = np.array(features_to_vector(features)).reshape(1, -1)
                proba = self.model.predict_proba(vec)[0]
                idx = int(np.argmax(proba))
                diagnosis = CATEGORIES[idx]
                confidence = float(proba[idx])
                order = np.argsort(proba)[::-1]
                alternatives = [
                    {'diagnosis': CATEGORIES[int(i)], 'probability': round(float(proba[int(i)]), 2)}
                    for i in order if int(i) != idx
                ][:2]
                return {
                    'diagnosis': diagnosis,
                    'confidence': round(confidence, 4),
                    'model_version': self.VERSION,
                    'factors': ['model_prediction'],
                    'alternatives': alternatives,
                }
            except Exception as e:
                print(f"[DiagnosisModel] predict failed, rule fallback: {e}")
        return self._rule_predict(features)

    def evaluate(self) -> dict:
        if not self.is_initialized:
            self.initialize()
        if self.eval_metrics:
            return dict(self.eval_metrics)
        return {'error': 'sklearn unavailable — no trained evaluation'}

    def predict_batch(self, features_list: list) -> list:
        return [self.predict(features) for features in features_list]
