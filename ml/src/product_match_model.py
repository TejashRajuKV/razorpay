"""
Product Match Model — AI Revenue Recovery Agent

Predicts the probability that an inactive customer will purchase a new product
if sent a targeted campaign message.

Features:
- inactive_days (int)
- category_match (bool): whether the product category is in the customer's preferred_categories
- customer_success_rate (float)
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

class ProductMatchModel:
    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=3,
            random_state=42
        )
        
    def _extract_features(self, df: pd.DataFrame, product_category: str) -> np.ndarray:
        """Extract features for product matching."""
        # 1. Inactive days
        inactive_days = df["inactive_days"].values.astype(float)
        
        # 2. Category match
        import json
        def check_match(cats_json):
            try:
                cats = json.loads(cats_json)
                return 1.0 if product_category in cats else 0.0
            except:
                return 0.0
        
        category_match = df["preferred_categories"].apply(check_match).values.astype(float)
        
        # 3. Success rate
        success_rate = df["customer_success_rate"].values.astype(float)
        
        return np.column_stack([inactive_days, category_match, success_rate])
        
    def train(self, df: pd.DataFrame, product_category: str, y_true: np.ndarray):
        X = self._extract_features(df, product_category)
        self.model.fit(X, y_true)
        
    def predict(self, df: pd.DataFrame, product_category: str) -> np.ndarray:
        X = self._extract_features(df, product_category)
        return np.clip(self.model.predict(X), 0.0, 1.0)
