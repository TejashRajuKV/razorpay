-- AI Revenue Recovery Agent Database Schema
-- Designed for PostgreSQL/MySQL compatibility

-- Customers table: Core customer profile and payment history summary
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_payments INT DEFAULT 0,
    successful_payments INT DEFAULT 0,
    failed_payments INT DEFAULT 0,
    total_revenue DECIMAL(15, 2) DEFAULT 0.00,
    risk_score DECIMAL(5, 4) DEFAULT 0.0000,
    last_payment_date TIMESTAMP,
    customer_segment VARCHAR(50) DEFAULT 'standard'
);

-- Payments table: Individual payment transactions
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'pending', 'abandoned'
    payment_method VARCHAR(50),
    failure_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Recovery cases table: Revenue-at-risk cases with diagnosis and status
CREATE TABLE IF NOT EXISTS recovery_cases (
    id VARCHAR(36) PRIMARY KEY,
    payment_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    amount_at_risk DECIMAL(15, 2) NOT NULL,
    risk_probability DECIMAL(5, 4) NOT NULL,
    diagnosis VARCHAR(100) NOT NULL, -- 'temporary_failure', 'repeated_failure', 'abandonment', 'overdue'
    diagnosis_factors JSON,
    priority_score DECIMAL(5, 4) NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'stopped', 'escalated'
    recommended_action VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    recovered_amount DECIMAL(15, 2) DEFAULT 0.00,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Recovery actions table: Actions attempted on recovery cases
CREATE TABLE IF NOT EXISTS recovery_actions (
    id VARCHAR(36) PRIMARY KEY,
    case_id VARCHAR(36) NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- 'retry', 'retry_later', 'reminder', 'payment_link', 'escalate', 'stop'
    action_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'executed', 'success', 'failed'
    attempt_number INT NOT NULL DEFAULT 1,
    executed_at TIMESTAMP,
    result_message TEXT,
    recovery_amount DECIMAL(15, 2) DEFAULT 0.00,
    cooldown_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE CASCADE
);

-- ML predictions table: Cache predictions with model versioning
CREATE TABLE IF NOT EXISTS ml_predictions (
    id VARCHAR(36) PRIMARY KEY,
    case_id VARCHAR(36),
    prediction_type VARCHAR(50) NOT NULL, -- 'risk', 'diagnosis', 'recovery_probability'
    model_version VARCHAR(50) NOT NULL,
    input_features JSON,
    prediction_result JSON,
    confidence_score DECIMAL(5, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE SET NULL
);

-- Customer responses table: Inbound customer replies with detected intent and
-- promise-to-pay lifecycle (NONE | PROMISED | FULFILLED | MISSED | CANCELLED).
-- Written ONLY by the customer-response flow; never executes recovery actions.
CREATE TABLE IF NOT EXISTS customer_responses (
    id VARCHAR(36) PRIMARY KEY,
    case_id VARCHAR(36) NOT NULL,
    message TEXT,
    intent VARCHAR(50) NOT NULL, -- 'promise_to_pay', 'payment_link_request', 'already_paid', 'refusal', 'human_help', 'unclear'
    confidence DECIMAL(5, 4) DEFAULT 0.0000,
    promised_at TIMESTAMP,
    promise_status VARCHAR(20) DEFAULT 'NONE',
    follow_up_required INT DEFAULT 0,
    follow_up_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE CASCADE
);

-- Audit logs table: Immutable event history
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'case', 'action', 'payment', 'customer'
    entity_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON NOT NULL,
    previous_state JSON,
    new_state JSON,
    user_or_system VARCHAR(100) DEFAULT 'system',
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table: Simulated reminders and payment link events
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    case_id VARCHAR(36) NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'reminder', 'payment_link', 'escalation'
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    content TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_status ON recovery_cases(status);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_customer ON recovery_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_case ON recovery_actions(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_responses_case ON customer_responses(case_id);
