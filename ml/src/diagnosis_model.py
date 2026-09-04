"""
Diagnosis Model - Root Cause Classification
Local sklearn classifier trained on synthetic data (no external APIs).
Falls back to rules if sklearn is unavailable.
Categories: temporary_failure, repeated_failure, data_issue, abandonment
"""

import numpy as np

CATEGORIES = [
    'temporary_failure',
    'repeated_failure',
    'data_issue',
    'abandonment',
]

FAILURE_REASONS = [
    'insufficient_funds', 'card_expired', 'transaction_timeout',
    'bank_error', 'declined_by_bank', 'invalid_upi_id',
    'card_limit_exceeded', 'unknown',
    # appended last so existing vocabulary indices stay stable
    'checkout_abandoned',
]

REASON_DIAGNOSIS_MAP = {
    'insufficient_funds': 'temporary_failure',
    'transaction_timeout': 'temporary_failure',
    'bank_error': 'temporary_failure',
    'card_expired': 'data_issue',
    'invalid_upi_id': 'data_issue',
    'declined_by_bank': 'temporary_failure',
    'card_limit_exceeded': 'temporary_failure',
    'checkout_abandoned': 'abandonment',
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
            label = 'abandonment'
        elif fr in ('card_expired', 'invalid_upi_id'):
            label = 'data_issue'
        elif attempts >= 3 or (success_rate < 0.5 and total > 3):
            label = 'repeated_failure'
        else:
            label = 'temporary_failure'
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
        diagnosis = REASON_DIAGNOSIS_MAP.get(failure_reason, 'temporary_failure')
        confidence = 0.65
        factors = ['failure_reason_match']
        if attempt_count >= 3 or (customer_success_rate < 0.5 and customer_total_payments > 3):
            diagnosis = 'repeated_failure'
            confidence = max(confidence, 0.75)
            factors.append('repeated_pattern_detected')
        if payment_status == 'abandoned':
            diagnosis = 'abandonment'
            confidence = 0.85
            factors = ['checkout_abandonment']
        if diagnosis == 'data_issue':
            confidence = max(confidence, 0.85)
        if days_since_failure > 7 and diagnosis == 'temporary_failure':
            diagnosis = 'repeated_failure'
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
