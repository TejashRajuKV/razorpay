"""Recovery model tests — require: pip install -r ml/requirements.txt, run: pytest ml/tests."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.recovery_model import RecoveryProbabilityModel, ACTIONS


def test_actions_vocab():
    assert set(ACTIONS) == {'retry', 'reminder', 'payment_link', 'retry_later', 'escalate', 'stop'}


def test_predict_shape():
    m = RecoveryProbabilityModel().initialize()
    r = m.predict({'customer_success_rate': 0.9, 'customer_total_payments': 12,
                   'previous_recovery_attempts': 0,
                   'amount_relative_to_average': 1.0, 'customer_segment': 'standard'},
                  'temporary_failure')
    assert set(r['probabilities'].keys()) == set(ACTIONS)
    assert r['recommended_action'] in ACTIONS
    assert r['diagnosis_used'] == 'temporary_failure'


def test_evaluate_real_metrics_or_honest_error():
    m = RecoveryProbabilityModel().initialize()
    e = m.evaluate()
    if 'error' in e:
        assert 'sklearn' in e['error']
    else:
        assert 0.0 <= e['accuracy'] <= 1.0
