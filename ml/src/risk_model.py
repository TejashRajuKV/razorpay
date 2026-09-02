"""
Revenue Risk Prediction Model
Predicts the probability that a payment will result in lost revenue
Uses rule-based approach with fallback heuristics (no external API dependencies)
"""

import numpy as np


class RiskPredictionModel:
    """
    Revenue risk prediction model using heuristic rules and statistical patterns.
    In production, this would be replaced with a trained ML model.
    """
    
    VERSION = "v1.0.0"
    
    # Failure reason risk modifiers
    FAILURE_RISK_MODIFIERS = {
        'insufficient_funds': 0.15,
        'card_expired': 0.35,
        'transaction_timeout': -0.10,
        'bank_error': 0.05,
        'declined_by_bank': 0.25,
        'invalid_upi_id': 0.40,
        'card_limit_exceeded': 0.20,
        'default': 0.10
    }
    
    # Payment method risk weights
    PAYMENT_METHOD_RISK = {
        'credit_card': 0.3,
        'debit_card': 0.4,
        'upi': 0.25,
        'net_banking': 0.35,
        'wallet': 0.2,
        'default': 0.3
    }
    
    def __init__(self):
        self.is_initialized = False
    
    def initialize(self):
        """Initialize model (load weights, etc.)"""
        self.is_initialized = True
        return self
    
    def predict(self, features: dict) -> dict:
        """
        Predict revenue risk probability
        
        Args:
            features: Dictionary containing payment and customer features
            
        Returns:
            Dictionary with risk_probability, confidence, model_version, and factors
        """
        if not self.is_initialized:
            self.initialize()
        
        # Extract features with defaults
        amount = features.get('amount', 0)
        payment_method = features.get('payment_method', 'unknown')
        failure_reason = features.get('failure_reason', 'unknown')
        customer_success_rate = features.get('customer_success_rate', 0.7)
        customer_total_payments = features.get('customer_total_payments', 1)
        customer_risk_score = features.get('customer_risk_score', 0.5)
        
        # Calculate base risk from customer history
        base_risk = 1.0 - customer_success_rate
        
        # Apply failure reason modifier
        failure_modifier = self.FAILURE_RISK_MODIFIERS.get(
            failure_reason, 
            self.FAILURE_RISK_MODIFIERS['default']
        )
        
        # Apply payment method modifier
        pm_modifier = self.PAYMENT_METHOD_RISK.get(
            payment_method,
            self.PAYMENT_METHOD_RISK['default']
        ) * 0.1
        
        # Apply customer volume modifier (more payments = more reliable pattern)
        volume_factor = min(1.0, customer_total_payments / 20)
        volume_modifier = (1.0 - volume_factor) * 0.1
        
        # Calculate final risk probability
        risk_probability = base_risk + failure_modifier + pm_modifier + volume_modifier
        
        # Adjust by existing customer risk score
        risk_probability = (risk_probability * 0.6) + (customer_risk_score * 0.4)
        
        # Clamp to valid range
        risk_probability = max(0.05, min(0.95, risk_probability))
        
        # Determine contributing factors
        factors = []
        if failure_modifier > 0.2:
            factors.append('high_risk_failure_reason')
        if customer_success_rate < 0.6:
            factors.append('poor_payment_history')
        if customer_total_payments < 3:
            factors.append('limited_history')
        if amount > 30000:
            factors.append('high_transaction_amount')
        
        # Calculate confidence based on data availability
        confidence = 0.6  # Base confidence for heuristic model
        if customer_total_payments > 10:
            confidence += 0.15
        elif customer_total_payments > 5:
            confidence += 0.10
        else:
            confidence -= 0.10
        
        if failure_reason in self.FAILURE_RISK_MODIFIERS:
            confidence += 0.10
        
        confidence = min(0.95, confidence)
        
        return {
            'risk_probability': round(risk_probability, 4),
            'confidence': round(confidence, 4),
            'model_version': self.VERSION,
            'factors': factors if factors else ['baseline_prediction']
        }
    
    def predict_batch(self, features_list: list) -> list:
        """
        Predict risk for multiple cases
        
        Args:
            features_list: List of feature dictionaries
            
        Returns:
            List of prediction results
        """
        return [self.predict(features) for features in features_list]
