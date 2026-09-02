-- Seed data for AI Revenue Recovery Agent
-- Provides realistic synthetic data for demonstration and testing

-- Insert customers with varying payment histories
INSERT INTO customers (id, name, email, phone, total_payments, successful_payments, failed_payments, total_revenue, risk_score, customer_segment) VALUES
('cust_001', 'Rahul Sharma', 'rahul.sharma@example.com', '+91-9876543210', 15, 14, 1, 125000.00, 0.1500, 'premium'),
('cust_002', 'Priya Patel', 'priya.patel@example.com', '+91-9876543211', 8, 6, 2, 45000.00, 0.3200, 'standard'),
('cust_003', 'Amit Kumar', 'amit.kumar@example.com', '+91-9876543212', 22, 20, 2, 280000.00, 0.1200, 'premium'),
('cust_004', 'Sneha Reddy', 'sneha.reddy@example.com', '+91-9876543213', 5, 3, 2, 18000.00, 0.4500, 'standard'),
('cust_005', 'Vikram Singh', 'vikram.singh@example.com', '+91-9876543214', 12, 11, 1, 95000.00, 0.1800, 'premium'),
('cust_006', 'Ananya Das', 'ananya.das@example.com', '+91-9876543215', 3, 1, 2, 8000.00, 0.6200, 'new'),
('cust_007', 'Rohan Mehta', 'rohan.mehta@example.com', '+91-9876543216', 18, 17, 1, 165000.00, 0.1100, 'premium'),
('cust_008', 'Divya Nair', 'divya.nair@example.com', '+91-9876543217', 7, 5, 2, 32000.00, 0.3800, 'standard');

-- Insert payments with various statuses
INSERT INTO payments (id, customer_id, amount, currency, status, payment_method, failure_reason, metadata) VALUES
('pay_001', 'cust_001', 25000.00, 'INR', 'failed', 'credit_card', 'insufficient_funds', '{"attempt": 1, "gateway": "hdfc"}'),
('pay_002', 'cust_002', 12000.00, 'INR', 'failed', 'debit_card', 'card_expired', '{"attempt": 1, "gateway": "icici"}'),
('pay_003', 'cust_003', 45000.00, 'INR', 'failed', 'upi', 'transaction_timeout', '{"attempt": 2, "gateway": "razorpay"}'),
('pay_004', 'cust_004', 8500.00, 'INR', 'failed', 'net_banking', 'bank_error', '{"attempt": 1, "gateway": "sbi"}'),
('pay_005', 'cust_005', 18000.00, 'INR', 'failed', 'credit_card', 'declined_by_bank', '{"attempt": 1, "gateway": "hdfc"}'),
('pay_006', 'cust_006', 5500.00, 'INR', 'failed', 'upi', 'invalid_upi_id', '{"attempt": 3, "gateway": "razorpay"}'),
('pay_007', 'cust_007', 32000.00, 'INR', 'failed', 'debit_card', 'insufficient_funds', '{"attempt": 1, "gateway": "icici"}'),
('pay_008', 'cust_008', 15000.00, 'INR', 'failed', 'credit_card', 'card_limit_exceeded', '{"attempt": 2, "gateway": "hdfc"}'),
('pay_009', 'cust_001', 15000.00, 'INR', 'success', 'credit_card', NULL, '{"attempt": 1, "gateway": "hdfc"}'),
('pay_010', 'cust_003', 28000.00, 'INR', 'success', 'upi', NULL, '{"attempt": 1, "gateway": "razorpay"}');

-- Insert recovery cases
INSERT INTO recovery_cases (id, payment_id, customer_id, amount_at_risk, risk_probability, diagnosis, diagnosis_factors, priority_score, status, recommended_action) VALUES
('case_001', 'pay_001', 'cust_001', 25000.00, 0.8500, 'temporary_failure', '{"history": "good", "failures": 1, "amount_relative": "normal"}', 0.7800, 'open', 'retry'),
('case_002', 'pay_002', 'cust_002', 12000.00, 0.7200, 'temporary_failure', '{"history": "moderate", "failures": 2, "amount_relative": "high"}', 0.6500, 'open', 'reminder'),
('case_003', 'pay_003', 'cust_003', 45000.00, 0.6800, 'temporary_failure', '{"history": "excellent", "failures": 2, "amount_relative": "high"}', 0.8200, 'in_progress', 'retry'),
('case_004', 'pay_004', 'cust_004', 8500.00, 0.5500, 'repeated_failure', '{"history": "poor", "failures": 2, "amount_relative": "low"}', 0.4200, 'open', 'payment_link'),
('case_005', 'pay_005', 'cust_005', 18000.00, 0.7800, 'temporary_failure', '{"history": "good", "failures": 1, "amount_relative": "normal"}', 0.7100, 'open', 'retry'),
('case_006', 'pay_006', 'cust_006', 5500.00, 0.4200, 'repeated_failure', '{"history": "poor", "failures": 3, "amount_relative": "low"}', 0.2800, 'stopped', 'stop'),
('case_007', 'pay_007', 'cust_007', 32000.00, 0.8100, 'temporary_failure', '{"history": "excellent", "failures": 1, "amount_relative": "normal"}', 0.8500, 'open', 'retry'),
('case_008', 'pay_008', 'cust_008', 15000.00, 0.6200, 'temporary_failure', '{"history": "moderate", "failures": 2, "amount_relative": "normal"}', 0.5800, 'escalated', 'escalate');

-- Insert recovery actions
INSERT INTO recovery_actions (id, case_id, action_type, action_status, attempt_number, result_message, recovery_amount) VALUES
('act_001', 'case_001', 'retry', 'success', 1, 'Payment succeeded on retry', 25000.00),
('act_002', 'case_002', 'reminder', 'executed', 1, 'Reminder email sent', 0.00),
('act_003', 'case_003', 'retry', 'executed', 1, 'Retry initiated, awaiting result', 0.00),
('act_004', 'case_004', 'payment_link', 'pending', 1, 'Payment link generated', 0.00),
('act_005', 'case_005', 'retry', 'failed', 1, 'Retry failed: insufficient funds', 0.00),
('act_006', 'case_006', 'stop', 'executed', 1, 'Stopped due to repeated failures', 0.00),
('act_007', 'case_007', 'retry', 'pending', 1, 'Retry queued', 0.00),
('act_008', 'case_008', 'escalate', 'executed', 1, 'Escalated to human review', 0.00);

-- Insert audit logs
INSERT INTO audit_logs (id, entity_type, entity_id, event_type, event_data, previous_state, new_state) VALUES
('audit_001', 'case', 'case_001', 'case_created', '{"payment_id": "pay_001", "amount": 25000}', NULL, '{"status": "open"}'),
('audit_002', 'case', 'case_001', 'diagnosis_completed', '{"diagnosis": "temporary_failure", "confidence": 0.85}', '{"status": "open"}', '{"recommended_action": "retry"}'),
('audit_003', 'action', 'act_001', 'action_executed', '{"action_type": "retry", "attempt": 1}', NULL, '{"status": "success"}'),
('audit_004', 'case', 'case_001', 'case_resolved', '{"recovered_amount": 25000}', '{"status": "in_progress"}', '{"status": "resolved"}'),
('audit_005', 'case', 'case_006', 'case_stopped', '{"reason": "max_retries_reached"}', '{"status": "in_progress"}', '{"status": "stopped"}'),
('audit_006', 'case', 'case_008', 'case_escalated', '{"reason": "low_confidence_high_value"}', '{"status": "open"}', '{"status": "escalated"}');

-- Insert ML predictions
INSERT INTO ml_predictions (id, case_id, prediction_type, model_version, prediction_result, confidence_score) VALUES
('pred_001', 'case_001', 'risk', 'v1.0.0', '{"risk_probability": 0.85}', 0.9200),
('pred_002', 'case_001', 'diagnosis', 'v1.0.0', '{"diagnosis": "temporary_failure"}', 0.8800),
('pred_003', 'case_001', 'recovery_probability', 'v1.0.0', '{"retry": 0.78, "reminder": 0.45}', 0.8500),
('pred_004', 'case_006', 'risk', 'v1.0.0', '{"risk_probability": 0.42}', 0.7800),
('pred_005', 'case_006', 'diagnosis', 'v1.0.0', '{"diagnosis": "repeated_failure"}', 0.8200);
