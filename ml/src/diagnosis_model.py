"""
Diagnosis Model - Root Cause Classification
Classifies the likely reason for a payment failure
Categories: temporary_failure, repeated_failure, data_issue, abandonment
"""


class DiagnosisModel:
    """
    Payment failure diagnosis model using rule-based classification.
    In production, this would be replaced with a trained ML classifier.
    """
    
    VERSION = "v1.0.0"
    
    # Diagnosis categories
    CATEGORIES = [
        'temporary_failure',
        'repeated_failure', 
        'data_issue',
        'abandonment'
    ]
    
    # Failure reason to diagnosis mapping
    REASON_DIAGNOSIS_MAP = {
        'insufficient_funds': 'temporary_failure',
        'transaction_timeout': 'temporary_failure',
        'bank_error': 'temporary_failure',
        'card_expired': 'data_issue',
        'invalid_upi_id': 'data_issue',
        'declined_by_bank': 'temporary_failure',
        'card_limit_exceeded': 'temporary_failure'
    }
    
    # Confidence scores by reason
    REASON_CONFIDENCE = {
        'insufficient_funds': 0.75,
        'transaction_timeout': 0.80,
        'bank_error': 0.70,
        'card_expired': 0.90,
        'invalid_upi_id': 0.92,
        'declined_by_bank': 0.65,
        'card_limit_exceeded': 0.72
    }
    
    def __init__(self):
        self.is_initialized = False
    
    def initialize(self):
        """Initialize model"""
        self.is_initialized = True
        return self
    
    def predict(self, features: dict) -> dict:
        """
        Diagnose the root cause of payment failure
        
        Args:
            features: Dictionary containing failure and customer features
            
        Returns:
            Dictionary with diagnosis, confidence, factors, and alternatives
        """
        if not self.is_initialized:
            self.initialize()
        
        # Extract features
        failure_reason = features.get('failure_reason', 'unknown')
        attempt_count = features.get('attempt_count', 1)
        customer_success_rate = features.get('customer_success_rate', 0.7)
        customer_total_payments = features.get('customer_total_payments', 1)
        payment_status = features.get('payment_status', 'failed')
        days_since_failure = features.get('days_since_failure', 0)
        
        # Initial diagnosis based on failure reason
        base_diagnosis = self.REASON_DIAGNOSIS_MAP.get(
            failure_reason, 
            'temporary_failure'
        )
        base_confidence = self.REASON_CONFIDENCE.get(
            failure_reason,
            0.65
        )
        
        # Adjust diagnosis based on patterns
        diagnosis = base_diagnosis
        confidence = base_confidence
        factors = ['failure_reason_match']
        
        # Check for repeated failure pattern
        if attempt_count >= 3 or (customer_success_rate < 0.5 and customer_total_payments > 3):
            diagnosis = 'repeated_failure'
            confidence = max(confidence, 0.75)
            factors.append('repeated_pattern_detected')
        
        # Check for abandonment
        if payment_status == 'abandoned':
            diagnosis = 'abandonment'
            confidence = 0.85
            factors = ['checkout_abandonment']
        
        # Data issues have high confidence when reason is clear
        if base_diagnosis == 'data_issue':
            confidence = max(confidence, 0.85)
        
        # Time-based adjustments
        if days_since_failure > 7 and diagnosis == 'temporary_failure':
            diagnosis = 'repeated_failure'
            factors.append('time_decay')
        
        # Calculate alternative diagnoses
        alternatives = []
        for category in self.CATEGORIES:
            if category != diagnosis:
                alt_probability = 0.1  # Base alternative probability
                if category == 'temporary_failure' and diagnosis == 'repeated_failure':
                    alt_probability = 0.25
                elif category == 'repeated_failure' and diagnosis == 'temporary_failure':
                    alt_probability = 0.20
                
                alternatives.append({
                    'diagnosis': category,
                    'probability': round(alt_probability, 2)
                })
        
        # Sort alternatives by probability
        alternatives.sort(key=lambda x: x['probability'], reverse=True)
        alternatives = alternatives[:2]  # Keep top 2
        
        # Adjust confidence based on data availability
        if customer_total_payments > 10:
            confidence = min(0.95, confidence + 0.10)
        elif customer_total_payments < 3:
            confidence = max(0.50, confidence - 0.10)
        
        return {
            'diagnosis': diagnosis,
            'confidence': round(confidence, 4),
            'model_version': self.VERSION,
            'factors': factors,
            'alternatives': alternatives
        }
    
    def predict_batch(self, features_list: list) -> list:
        """Predict diagnosis for multiple cases"""
        return [self.predict(features) for features in features_list]
