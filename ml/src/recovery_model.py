"""
Recovery Probability Model
Local sklearn classifier for best-action prediction trained on synthetic data
(no external APIs). Falls back to heuristic rates if sklearn is unavailable.
Actions: retry, reminder, payment_link, retry_later, escalate, stop
"""

import numpy as np

ACTIONS = ['retry', 'reminder', 'payment_link', 'retry_later', 'escalate', 'stop']

BASE_RATES = {
    'temporary_failure': {'retry': 0.65, 'reminder': 0.30, 'payment_link': 0.40, 'retry_later': 0.45, 'escalate': 0.50, 'stop': 0.0},
    'repeated_failure': {'retry': 0.25, 'reminder': 0.20, 'payment_link': 0.35, 'retry_later': 0.20, 'escalate': 0.45, 'stop': 0.0},
    'data_issue': {'retry': 0.15, 'reminder': 0.35, 'payment_link': 0.55, 'retry_later': 0.15, 'escalate': 0.40, 'stop': 0.0},
    'abandonment': {'retry': 0.20, 'reminder': 0.45, 'payment_link': 0.50, 'retry_later': 0.25, 'escalate': 0.30, 'stop': 0.0},
}

DIAGNOSES = ['temporary_failure', 'repeated_failure', 'data_issue', 'abandonment']
SEGMENTS = ['standard', 'premium', 'new']


def _encode(value, vocabulary):
    try:
        return float(vocabulary.index(value))
    except ValueError:
        return 0.0


def features_to_vector(case_features: dict, diagnosis: str):
    return [
        _encode(diagnosis, DIAGNOSES),
        float(case_features.get('customer_success_rate', 0.7)),
        float(case_features.get('customer_total_payments', 1)) / 30.0,
        float(case_features.get('previous_recovery_attempts', 0)) / 5.0,
        float(case_features.get('amount_relative_to_average', 1.0)) / 3.0,
        _encode(case_features.get('customer_segment', 'standard'), SEGMENTS),
    ]


def _best_action_for(diagnosis, success_rate, segment, attempts, amount_rel):
    rates = dict(BASE_RATES.get(diagnosis, BASE_RATES['temporary_failure']))
    hist = 1.0 + (success_rate - 0.5) * 0.4
    for a in rates:
        if rates[a] > 0:
            rates[a] *= hist
    seg = {'premium': 1.15, 'standard': 1.0, 'new': 0.90}.get(segment, 1.0)
    for a in rates:
        if rates[a] > 0:
            rates[a] *= seg
    penalty = max(0.4, 1.0 - attempts * 0.15)
    for a in ('retry', 'reminder', 'retry_later'):
        rates[a] *= penalty
    best = max(rates.items(), key=lambda kv: kv[1])[0]
    if rates[best] < 0.25:
        return 'escalate' if amount_rel > 2.0 else 'stop'
    return best


def _synthetic_dataset(n=3000, seed=11):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for _ in range(n):
        diag = str(rng.choice(DIAGNOSES))
        success_rate = float(rng.uniform(0.05, 1.0))
        total = float(rng.integers(1, 40))
        attempts = float(rng.integers(0, 5))
        amount_rel = float(rng.uniform(0.2, 4.0))
        segment = str(rng.choice(SEGMENTS))
        feats = {
            'customer_success_rate': success_rate,
            'customer_total_payments': total,
            'previous_recovery_attempts': attempts,
            'amount_relative_to_average': amount_rel,
            'customer_segment': segment,
        }
        label = _best_action_for(diag, success_rate, segment, attempts, amount_rel)
        X.append(features_to_vector(feats, diag))
        y.append(ACTIONS.index(label))
    return np.array(X), np.array(y)


class RecoveryProbabilityModel:
    VERSION = "v2.0.0-sklearn"
    BASE_RATES = BASE_RATES

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
                X, y, test_size=0.2, random_state=11, stratify=y
            )
            clf = RandomForestClassifier(n_estimators=140, max_depth=10, random_state=11, n_jobs=1)
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
            print(f"[RecoveryModel] sklearn unavailable, heuristic fallback: {e}")
            self.model = None
        self.is_initialized = True
        return self

    def _heuristic_predict(self, case_features: dict, diagnosis: str) -> dict:
        base_rates = dict(BASE_RATES.get(diagnosis, BASE_RATES['temporary_failure']))
        customer_success_rate = case_features.get('customer_success_rate', 0.7)
        previous_attempts = case_features.get('previous_recovery_attempts', 0)
        amount_relative = case_features.get('amount_relative_to_average', 1.0)
        customer_segment = case_features.get('customer_segment', 'standard')
        history_modifier = 1.0 + (customer_success_rate - 0.5) * 0.4
        for action in base_rates:
            if base_rates[action] > 0:
                base_rates[action] *= history_modifier
        segment_mod = {'premium': 1.15, 'standard': 1.0, 'new': 0.90}.get(customer_segment, 1.0)
        for action in base_rates:
            if base_rates[action] > 0:
                base_rates[action] *= segment_mod
        attempt_penalty = max(0.4, 1.0 - (previous_attempts * 0.15))
        for action in ['retry', 'reminder', 'retry_later']:
            if base_rates[action] > 0:
                base_rates[action] *= attempt_penalty
        probabilities = {k: round(min(0.95, v), 4) for k, v in base_rates.items()}
        recommended_action = 'stop'
        highest_prob = 0
        for action, prob in probabilities.items():
            if prob > highest_prob and prob >= 0.25:
                highest_prob = prob
                recommended_action = action
        if recommended_action == 'stop' and amount_relative > 2.0:
            recommended_action = 'escalate'
        return {
            'probabilities': probabilities,
            'recommended_action': recommended_action,
            'model_version': 'v1.0.0-heuristic',
            'diagnosis_used': diagnosis,
        }

    def predict(self, case_features: dict, diagnosis: str) -> dict:
        if not self.is_initialized:
            self.initialize()
        heuristic = self._heuristic_predict(case_features, diagnosis)
        if self.model is not None:
            try:
                vec = np.array(features_to_vector(case_features, diagnosis)).reshape(1, -1)
                proba = self.model.predict_proba(vec)[0]
                probs = {a: round(float(proba[ACTIONS.index(a)]), 4) for a in ACTIONS}
                # Blend model distribution with heuristic magnitudes for calibrated probabilities
                blended = {}
                for a in ACTIONS:
                    h = float(heuristic['probabilities'].get(a, 0.0))
                    m = float(probs[a])
                    if h > 0:
                        val = 0.5 * h + 0.5 * (0.5 * h + 0.5 * m)
                        blended[a] = round(min(0.95, val), 4)
                    else:
                        blended[a] = round(m * 0.3, 4)
                # Recommended = argmax of model distribution (fallback to heuristic if stop-heavy)
                idx = int(np.argmax(proba))
                recommended = ACTIONS[idx]
                if blended.get(recommended, 0) < 0.25:
                    recommended = heuristic['recommended_action']
                return {
                    'probabilities': blended,
                    'recommended_action': recommended,
                    'model_version': self.VERSION,
                    'diagnosis_used': diagnosis,
                }
            except Exception as e:
                print(f"[RecoveryModel] predict failed, heuristic fallback: {e}")
        return heuristic

    def evaluate(self) -> dict:
        if not self.is_initialized:
            self.initialize()
        if self.eval_metrics:
            return dict(self.eval_metrics)
        return {'error': 'sklearn unavailable — no trained evaluation'}

    def get_action_ranking(self, case_features: dict, diagnosis: str) -> list:
        result = self.predict(case_features, diagnosis)
        return sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)
