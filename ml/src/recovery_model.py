"""
Recovery Probability Model
Predicts success probability for different recovery actions
Used to select the optimal recovery intervention
"""


class RecoveryProbabilityModel:
    """
    Recovery probability model using heuristic rules.
    In production, this would be replaced with a trained ML model.
    """
    
    VERSION = "v1.0.0"
    
    # Base success rates by action and diagnosis
    BASE_RATES = {
        'temporary_failure': {
            'retry': 0.65,
            'reminder': 0.30,
            'payment_link': 0.40,
            'retry_later': 0.45,
            'escalate': 0.50,
            'stop': 0.0
        },
        'repeated_failure': {
            'retry': 0.25,
            'reminder': 0.20,
            'payment_link': 0.35,
            'retry_later': 0.20,
            'escalate': 0.45,
            'stop': 0.0
        },
        'data_issue': {
            'retry': 0.15,
            'reminder': 0.35,
            'payment_link': 0.55,
            'retry_later': 0.15,
            'escalate': 0.40,
            'stop': 0.0
        },
        'abandonment': {
            'retry': 0.20,
            'reminder': 0.45,
            'payment_link': 0.50,
            'retry_later': 0.25,
            'escalate': 0.30,
            'stop': 0.0
        }
    }
    
    def __init__(self):
        self.is_initialized = False
    
    def initialize(self):
        """Initialize model"""
        self.is_initialized = True
        return self
    
    def predict(self, case_features: dict, diagnosis: str) -> dict:
        """
        Predict recovery probabilities for different actions
        
        Args:
            case_features: Dictionary containing case features
            diagnosis: Diagnosis category from diagnosis model
            
        Returns:
            Dictionary with probabilities by action and recommended action
        """
        if not self.is_initialized:
            self.initialize()
        
        # Get base rates for this diagnosis
        base_rates = self.BASE_RATES.get(
            diagnosis, 
            self.BASE_RATES['temporary_failure']
        ).copy()
        
        # Extract features for adjustments
        customer_success_rate = case_features.get('customer_success_rate', 0.7)
        customer_total_payments = case_features.get('customer_total_payments', 1)
        previous_attempts = case_features.get('previous_recovery_attempts', 0)
        amount_relative = case_features.get('amount_relative_to_average', 1.0)
        customer_segment = case_features.get('customer_segment', 'standard')
        
        # Apply customer history modifier
        history_modifier = 1.0 + (customer_success_rate - 0.5) * 0.4
        for action in base_rates:
            if base_rates[action] > 0:
                base_rates[action] *= history_modifier
        
        # Apply segment modifier
        segment_modifiers = {
            'premium': 1.15,
            'standard': 1.0,
            'new': 0.90
        }
        segment_mod = segment_modifiers.get(customer_segment, 1.0)
        for action in base_rates:
            if base_rates[action] > 0:
                base_rates[action] *= segment_mod
        
        # Apply attempt penalty (diminishing returns)
        attempt_penalty = 1.0 - (previous_attempts * 0.15)
        attempt_penalty = max(0.4, attempt_penalty)
        for action in ['retry', 'reminder', 'retry_later']:
            if base_rates[action] > 0:
                base_rates[action] *= attempt_penalty
        
        # Normalize probabilities to sum close to 1 (not required but cleaner)
        total = sum(base_rates.values())
        if total > 0 and total != 1:
            # Keep relative proportions but scale down slightly
            for action in base_rates:
                base_rates[action] = min(0.90, base_rates[action])
        
        # Round all values
        probabilities = {k: round(min(0.95, v), 4) for k, v in base_rates.items()}
        
        # Determine recommended action (highest probability above threshold)
        threshold = 0.25
        recommended_action = 'stop'
        highest_prob = 0
        
        for action, prob in probabilities.items():
            if prob > highest_prob and prob >= threshold:
                highest_prob = prob
                recommended_action = action
        
        # If no action meets threshold, recommend stop or escalate for high value
        if recommended_action == 'stop' and amount_relative > 2.0:
            recommended_action = 'escalate'
        
        return {
            'probabilities': probabilities,
            'recommended_action': recommended_action,
            'model_version': self.VERSION,
            'diagnosis_used': diagnosis
        }
    
    def get_action_ranking(self, case_features: dict, diagnosis: str) -> list:
        """
        Get actions ranked by probability
        
        Returns:
            List of (action, probability) tuples sorted by probability descending
        """
        result = self.predict(case_features, diagnosis)
        probs = result['probabilities']
        
        ranking = sorted(probs.items(), key=lambda x: x[1], reverse=True)
        return ranking
