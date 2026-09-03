"""Risk model tests — require: pip install -r ml/requirements.txt, run: pytest ml/tests."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.risk_model import RiskPredictionModel, features_to_vector


def test_features_to_vector_length():
    vec = features_to_vector({'amount': 1000})
    assert len(vec) == 6


def test_predict_shape():
    m = RiskPredictionModel().initialize()
    r = m.predict({'amount': 25000, 'payment_method': 'upi',
                   'failure_reason': 'bank_error', 'customer_success_rate': 0.9,
                   'customer_total_payments': 12, 'customer_risk_score': 0.2})
    assert 0.05 <= r['risk_probability'] <= 0.95
    assert 'model_version' in r and isinstance(r['factors'], list)


def test_evaluate_real_metrics_or_honest_error():
    m = RiskPredictionModel().initialize()
    e = m.evaluate()
    if 'error' in e:
        assert 'sklearn' in e['error']
    else:
        for k in ('accuracy', 'precision', 'recall', 'f1', 'roc_auc'):
            assert 0.0 <= e[k] <= 1.0
