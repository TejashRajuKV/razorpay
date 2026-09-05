"""
AI Revenue Recovery Agent - ML Service API Server
Provides REST endpoints for risk prediction, diagnosis, and recovery probability scoring
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.risk_model import RiskPredictionModel
from src.diagnosis_model import DiagnosisModel
from src.recovery_model import RecoveryProbabilityModel

app = Flask(__name__)
CORS(app)

# Initialize models (lazy loading on first request)
risk_model = None
diagnosis_model = None
recovery_model = None


def get_risk_model():
    """Lazy load risk prediction model"""
    global risk_model
    if risk_model is None:
        risk_model = RiskPredictionModel()
        risk_model.initialize()
    return risk_model


def get_diagnosis_model():
    """Lazy load diagnosis model"""
    global diagnosis_model
    if diagnosis_model is None:
        diagnosis_model = DiagnosisModel()
        diagnosis_model.initialize()
    return diagnosis_model


def get_recovery_model():
    """Lazy load recovery probability model"""
    global recovery_model
    if recovery_model is None:
        recovery_model = RecoveryProbabilityModel()
        recovery_model.initialize()
    return recovery_model


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ml-recovery-service',
        'version': '1.0.0'
    })


@app.route('/predict/risk', methods=['POST'])
def predict_risk():
    """
    Predict revenue risk probability for a payment
    
    Request body:
    {
        "features": {
            "amount": 25000,
            "payment_method": "credit_card",
            "failure_reason": "insufficient_funds",
            "customer_total_payments": 15,
            "customer_success_rate": 0.93,
            ...
        }
    }
    
    Response:
    {
        "risk_probability": 0.85,
        "confidence": 0.92,
        "model_version": "v1.0.0",
        "factors": ["historical_success_rate", "failure_reason"]
    }
    """
    try:
        data = request.get_json()
        if not data or 'features' not in data:
            return jsonify({'error': 'features required'}), 400
        
        model = get_risk_model()
        result = model.predict(data['features'])
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict/diagnosis', methods=['POST'])
def predict_diagnosis():
    """
    Diagnose root cause of payment failure
    
    Request body:
    {
        "features": {
            "failure_reason": "insufficient_funds",
            "payment_method": "credit_card",
            "attempt_count": 1,
            ...
        }
    }
    
    Response:
    {
        "diagnosis": "temporary_failure",
        "confidence": 0.88,
        "model_version": "v1.0.0",
        "factors": ["failure_reason", "customer_history"],
        "alternatives": [
            {"diagnosis": "repeated_failure", "probability": 0.15}
        ]
    }
    """
    try:
        data = request.get_json()
        if not data or 'features' not in data:
            return jsonify({'error': 'features required'}), 400
        
        model = get_diagnosis_model()
        result = model.predict(data['features'])
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict/recovery', methods=['POST'])
def predict_recovery():
    """
    Predict recovery probability for different actions
    
    Request body:
    {
        "case_features": {...},
        "diagnosis": "temporary_failure"
    }
    
    Response:
    {
        "probabilities": {
            "retry": 0.78,
            "reminder": 0.45,
            "payment_link": 0.52,
            "retry_later": 0.35,
            "escalate": 0.25,
            "stop": 0.05
        },
        "recommended_action": "retry",
        "model_version": "v1.0.0"
    }
    """
    try:
        data = request.get_json()
        if not data or 'case_features' not in data or 'diagnosis' not in data:
            return jsonify({'error': 'case_features and diagnosis required'}), 400
        
        model = get_recovery_model()
        result = model.predict(data['case_features'], data['diagnosis'])
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict/batch', methods=['POST'])
def batch_predict():
    """
    Batch prediction for multiple cases
    
    Request body:
    {
        "cases": [
            {
                "risk_features": {...},
                "diagnosis_features": {...},
                "recovery_features": {...}
            },
            ...
        ]
    }
    
    Response:
    {
        "predictions": [
            {
                "risk_probability": 0.85,
                "diagnosis": "temporary_failure",
                "recovery_probabilities": {...}
            },
            ...
        ],
        "total_processed": 100
    }
    """
    try:
        data = request.get_json()
        if not data or 'cases' not in data:
            return jsonify({'error': 'cases array required'}), 400
        
        cases = data['cases']
        predictions = []
        
        risk_mdl = get_risk_model()
        diag_mdl = get_diagnosis_model()
        rec_mdl = get_recovery_model()
        
        for case in cases:
            risk_result = risk_mdl.predict(case.get('risk_features', {}))
            diag_result = diag_mdl.predict(case.get('diagnosis_features', {}))
            rec_result = rec_mdl.predict(
                case.get('recovery_features', {}),
                diag_result['diagnosis']
            )
            
            predictions.append({
                'risk_probability': risk_result['risk_probability'],
                'diagnosis': diag_result['diagnosis'],
                'diagnosis_confidence': diag_result['confidence'],
                'recovery_probabilities': rec_result['probabilities'],
                'recommended_action': rec_result['recommended_action']
            })
        
        return jsonify({
            'predictions': predictions,
            'total_processed': len(predictions)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/evaluate/risk', methods=['GET'])
def evaluate_risk():
    try:
        return jsonify(get_risk_model().evaluate())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/evaluate/diagnosis', methods=['GET'])
def evaluate_diagnosis():
    try:
        return jsonify(get_diagnosis_model().evaluate())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/evaluate/recovery', methods=['GET'])
def evaluate_recovery():
    try:
        return jsonify(get_recovery_model().evaluate())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/metrics', methods=['GET'])
def all_metrics():
    """Aggregate held-out evaluation metrics for every model."""
    try:
        return jsonify({
            'risk': get_risk_model().evaluate(),
            'diagnosis': get_diagnosis_model().evaluate(),
            'recovery': get_recovery_model().evaluate(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('ML_PORT', 5001))
    debug = os.environ.get('NODE_ENV', 'development') == 'development'
    
    print(f"Starting ML Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
