"""Diagnosis model tests — require: pip install -r ml/requirements.txt, run: pytest ml/tests."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.diagnosis_model import DiagnosisModel, CATEGORIES


def test_categories():
    assert set(CATEGORIES) == {'network_timeout', 'insufficient_funds', 'card_expired',
                               'upi_pin_error', 'bank_decline', 'abandoned', 'data_error'}


def test_predict_shape():
    m = DiagnosisModel().initialize()
    r = m.predict({'failure_reason': 'card_expired', 'attempt_count': 1,
                   'customer_success_rate': 0.9, 'customer_total_payments': 10})
    assert r['diagnosis'] in CATEGORIES
    assert 0.0 <= r['confidence'] <= 1.0
    assert isinstance(r['alternatives'], list)


def test_abandonment_signal():
    m = DiagnosisModel().initialize()
    r = m.predict({'failure_reason': 'unknown', 'payment_status': 'abandoned'})
    assert r['diagnosis'] == 'abandoned'


def test_evaluate_real_metrics_or_honest_error():
    m = DiagnosisModel().initialize()
    e = m.evaluate()
    if 'error' in e:
        assert 'sklearn' in e['error']
    else:
        assert 0.0 <= e['accuracy'] <= 1.0
