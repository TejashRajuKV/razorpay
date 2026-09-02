/**
 * AI Revenue Recovery Agent — Mock Data & Simulation State Engine
 * 
 * Provides rich, realistic synthetic payment events, customer profiles,
 * ML diagnostic outputs, explainable SHAP-style attribution factors,
 * bounded stopping guardrails, batch simulation records, and audit logs.
 */

export const INITIAL_METRICS = {
  totalMonitoredRevenue: 4850000,
  revenueAtRisk: 1420000,
  recoveredRevenue: 984500,
  recoveryRate: 69.33,
  casesProcessed: 142,
  activeCases: 18,
  stoppedCases: 6,
  escalatedCases: 4,
  mlAccuracy: 91.4,
  mlF1Score: 0.892,
  mlRocAuc: 0.945,
  avgRecoveryTimeMinutes: 14.2
};

export const INITIAL_CASES = [
  {
    id: "REC-1042",
    customer: {
      name: "Rahul Sharma",
      email: "rahul.sharma@example.com",
      phone: "+91 98765 43210",
      tier: "VIP_PLATINUM",
      lifetimeValue: 145000,
      historicalSuccessRate: 0.96,
      pastFailuresCount: 1,
      accountAgeMonths: 28
    },
    payment: {
      amount: 25000,
      currency: "INR",
      method: "UPI",
      bank: "HDFC_BANK",
      vpa: "rahul@okaxis",
      rawErrorCode: "NPCI_RESP_504_TIMEOUT",
      errorCategory: "GATEWAY_TIMEOUT",
      eventType: "FAILED_PAYMENT",
      timestamp: "2026-09-02T10:45:12Z",
      checkoutDwellSeconds: 42
    },
    diagnosis: {
      rootCause: "TEMPORARY_GATEWAY_DOWNTIME",
      friendlyName: "Temporary Bank Gateway Downtime",
      confidence: 0.94,
      severity: "MEDIUM",
      description: "NPCI/HDFC gateway experienced an intermittent 504 timeout. Customer has exceptional payment history.",
      factors: [
        { name: "Customer Historical Success Rate (>95%)", impact: "+32%", type: "positive" },
        { name: "High Bank Network Timeout Rate at 10 AM", impact: "+26%", type: "positive" },
        { name: "Zero Prior Insufficient Funds Flags", impact: "+18%", type: "positive" },
        { name: "First Failure on this Order", impact: "+14%", type: "positive" }
      ]
    },
    decision: {
      recommendedAction: "RETRY_IMMEDIATE",
      actionLabel: "Smart Immediate Retry",
      recoveryProbability: 0.92,
      expectedRecoveryValue: 23000,
      interventionCost: 0,
      channel: "AUTO_PAYMENT_GATEWAY",
      alternativeActions: [
        { action: "RETRY_OPTIMAL_WINDOW", label: "Retry in 2 Hours", prob: 0.86, expValue: 21500 },
        { action: "SEND_SMART_PAYMENT_LINK", label: "Smart Payment Link (SMS/WhatsApp)", prob: 0.74, expValue: 18500 },
        { action: "SWITCH_PAYMENT_METHOD", label: "Prompt Debit Card Fallback", prob: 0.65, expValue: 16250 },
        { action: "ESCALATE_HUMAN_REVIEW", label: "Escalate to Agent Support", prob: 0.50, expValue: 12500 }
      ]
    },
    guardrails: {
      maxRetriesAllowed: 3,
      retriesUsed: 0,
      cooldownMinutes: 15,
      cooldownRemainingSeconds: 0,
      maxTouchpoints: 5,
      touchpointsUsed: 0,
      isHighValueEscalationRequired: false,
      isCooldownSatisfied: true,
      stoppingRuleHit: null,
      status: "PASSED_ALL_SAFETY_CHECKS"
    },
    status: "DETECTED",
    recoveredAmount: 0,
    history: [
      { timestamp: "2026-09-02T10:45:12Z", actor: "DETECTION_ENGINE", event: "Revenue loss detected (₹25,000 at risk)" },
      { timestamp: "2026-09-02T10:45:13Z", actor: "LOCAL_ML_DIAGNOSIS", event: "Diagnosed as TEMPORARY_GATEWAY_DOWNTIME (94% conf)" },
      { timestamp: "2026-09-02T10:45:14Z", actor: "POLICY_ENGINE", event: "Recommended RETRY_IMMEDIATE with 92% recovery probability" }
    ]
  },
  {
    id: "REC-1043",
    customer: {
      name: "Priya Patel",
      email: "priya.p@finmail.in",
      phone: "+91 91234 56789",
      tier: "GOLD",
      lifetimeValue: 48000,
      historicalSuccessRate: 0.84,
      pastFailuresCount: 3,
      accountAgeMonths: 14
    },
    payment: {
      amount: 4850,
      currency: "INR",
      method: "CREDIT_CARD",
      bank: "ICICI_VISA",
      rawErrorCode: "3DS_OTP_EXPIRED_OR_ABORTED",
      errorCategory: "AUTHENTICATION_3DS_DROPOUT",
      eventType: "FAILED_PAYMENT",
      timestamp: "2026-09-02T10:30:00Z",
      checkoutDwellSeconds: 180
    },
    diagnosis: {
      rootCause: "AUTHENTICATION_3DS_DROPOUT",
      friendlyName: "3DS OTP Timeout / User Abandoned Step",
      confidence: 0.88,
      severity: "LOW",
      description: "User waited on the 3DS verification page but closed the window before OTP entry.",
      factors: [
        { name: "3DS Page Dwell Time (>180s)", impact: "+28%", type: "positive" },
        { name: "Active Card in Good Standing", impact: "+22%", type: "positive" },
        { name: "Prior Completed Cart History", impact: "+15%", type: "positive" },
        { name: "Previous OTP Dropout Experience", impact: "-10%", type: "negative" }
      ]
    },
    decision: {
      recommendedAction: "SEND_SMART_PAYMENT_LINK",
      actionLabel: "Generate Frictionless Payment Link",
      recoveryProbability: 0.84,
      expectedRecoveryValue: 4074,
      interventionCost: 2.5,
      channel: "WHATSAPP_AND_SMS",
      alternativeActions: [
        { action: "SEND_WHATSAPP_REMINDER", label: "WhatsApp Gentle Nudge", prob: 0.79, expValue: 3831 },
        { action: "SWITCH_PAYMENT_METHOD", label: "Prompt UPI Auto-Intent", prob: 0.72, expValue: 3492 },
        { action: "RETRY_IMMEDIATE", label: "Direct Retry (Low Likelihood)", prob: 0.12, expValue: 582 }
      ]
    },
    guardrails: {
      maxRetriesAllowed: 3,
      retriesUsed: 0,
      cooldownMinutes: 30,
      cooldownRemainingSeconds: 0,
      maxTouchpoints: 5,
      touchpointsUsed: 0,
      isHighValueEscalationRequired: false,
      isCooldownSatisfied: true,
      stoppingRuleHit: null,
      status: "PASSED_ALL_SAFETY_CHECKS"
    },
    status: "ACTION_SCHEDULED",
    recoveredAmount: 0,
    history: [
      { timestamp: "2026-09-02T10:30:00Z", actor: "DETECTION_ENGINE", event: "Detected 3DS drop on ₹4,850 order" },
      { timestamp: "2026-09-02T10:30:02Z", actor: "LOCAL_ML_DIAGNOSIS", event: "Classified as AUTHENTICATION_3DS_DROPOUT" },
      { timestamp: "2026-09-02T10:30:04Z", actor: "SAFETY_GUARDRAILS", event: "Direct retry prevented by policy (ineffective on 3DS drop)" },
      { timestamp: "2026-09-02T10:30:05Z", actor: "POLICY_ENGINE", event: "Scheduled 1-Click WhatsApp Smart Link" }
    ]
  },
  {
    id: "REC-1044",
    customer: {
      name: "Ananya Verma",
      email: "ananya.v@gmail.com",
      phone: "+91 99887 76655",
      tier: "SILVER",
      lifetimeValue: 12500,
      historicalSuccessRate: 0.79,
      pastFailuresCount: 2,
      accountAgeMonths: 6
    },
    payment: {
      amount: 18200,
      currency: "INR",
      method: "CHECKOUT_CART",
      bank: "N/A",
      rawErrorCode: "CART_ABANDONED_AT_PAYMENT_SELECTION",
      errorCategory: "CHECKOUT_FRICTION_ABANDONMENT",
      eventType: "ABANDONED_CHECKOUT",
      timestamp: "2026-09-02T09:50:00Z",
      checkoutDwellSeconds: 310
    },
    diagnosis: {
      rootCause: "CHECKOUT_FRICTION_ABANDONMENT",
      friendlyName: "Checkout Step Abandonment / Price Sensitivity",
      confidence: 0.81,
      severity: "MEDIUM",
      description: "Customer spent 5 minutes reviewing cart and shipping fees before exiting without selecting a gateway.",
      factors: [
        { name: "Long Payment Page Dwell (>300s)", impact: "+35%", type: "positive" },
        { name: "High Order Value vs Customer Avg", impact: "+20%", type: "positive" },
        { name: "High Mobile Cart Drop Rate Cohort", impact: "+15%", type: "positive" }
      ]
    },
    decision: {
      recommendedAction: "SEND_WHATSAPP_REMINDER",
      actionLabel: "WhatsApp Nudge with 5% Instant Recovery Voucher",
      recoveryProbability: 0.78,
      expectedRecoveryValue: 14196,
      interventionCost: 5.0,
      channel: "WHATSAPP_INTERACTIVE",
      alternativeActions: [
        { action: "SEND_SMART_PAYMENT_LINK", label: "Email Cart Recovery Link", prob: 0.62, expValue: 11284 },
        { action: "STOP_RECOVERY", label: "Do Not Contact", prob: 0.0, expValue: 0 }
      ]
    },
    guardrails: {
      maxRetriesAllowed: 3,
      retriesUsed: 0,
      cooldownMinutes: 60,
      cooldownRemainingSeconds: 0,
      maxTouchpoints: 3,
      touchpointsUsed: 0,
      isHighValueEscalationRequired: false,
      isCooldownSatisfied: true,
      stoppingRuleHit: null,
      status: "PASSED_ALL_SAFETY_CHECKS"
    },
    status: "ACTION_SCHEDULED",
    recoveredAmount: 0,
    history: [
      { timestamp: "2026-09-02T09:50:00Z", actor: "DETECTION_ENGINE", event: "Abandoned checkout captured (₹18,200)" },
      { timestamp: "2026-09-02T09:50:03Z", actor: "LOCAL_ML_DIAGNOSIS", event: "Diagnosed as CHECKOUT_FRICTION_ABANDONMENT" }
    ]
  },
  {
    id: "REC-1045",
    customer: {
      name: "Vikram Malhotra (Apex SaaS)",
      email: "billing@apexsaas.io",
      phone: "+91 97766 55443",
      tier: "ENTERPRISE",
      lifetimeValue: 850000,
      historicalSuccessRate: 0.98,
      pastFailuresCount: 0,
      accountAgeMonths: 36
    },
    payment: {
      amount: 145000,
      currency: "INR",
      method: "SUBSCRIPTION_AUTOPAY",
      bank: "KOTAK_NACH",
      rawErrorCode: "E_MANDATE_DEBIT_LIMIT_REACHED",
      errorCategory: "INSUFFICIENT_FUNDS",
      eventType: "FAILED_SUBSCRIPTION",
      timestamp: "2026-09-02T08:15:00Z",
      checkoutDwellSeconds: 0
    },
    diagnosis: {
      rootCause: "INSUFFICIENT_FUNDS",
      friendlyName: "Auto-Debit Account Balance Threshold",
      confidence: 0.89,
      severity: "HIGH",
      description: "Recurring quarterly enterprise invoice exceeded default auto-debit daily cap. Account has zero default history.",
      factors: [
        { name: "Enterprise Customer Tier (LTV ₹8.5L)", impact: "+40%", type: "positive" },
        { name: "Perfect Past Payment Record (98%)", impact: "+30%", type: "positive" },
        { name: "Quarter-End Billing Date", impact: "+15%", type: "positive" },
        { name: "High Value Flag (> ₹50,000 Threshold)", impact: "GUARDRAIL_TRIGGER", type: "neutral" }
      ]
    },
    decision: {
      recommendedAction: "ESCALATE_HUMAN_REVIEW",
      actionLabel: "Human Account Manager Escalation",
      recoveryProbability: 0.95,
      expectedRecoveryValue: 137750,
      interventionCost: 50.0,
      channel: "DEDICATED_ACCOUNT_MANAGER",
      alternativeActions: [
        { action: "SEND_SMART_PAYMENT_LINK", label: "Direct B2B Netbanking Link", prob: 0.88, expValue: 127600 },
        { action: "RETRY_OPTIMAL_WINDOW", label: "Retry on Payday / Tomorrow 10 AM", prob: 0.70, expValue: 101500 }
      ]
    },
    guardrails: {
      maxRetriesAllowed: 3,
      retriesUsed: 0,
      cooldownMinutes: 120,
      cooldownRemainingSeconds: 0,
      maxTouchpoints: 5,
      touchpointsUsed: 0,
      isHighValueEscalationRequired: true,
      isCooldownSatisfied: true,
      stoppingRuleHit: "HIGH_VALUE_THRESHOLD_EXCEEDED (Amount > ₹50,000)",
      status: "HELD_FOR_HUMAN_APPROVAL"
    },
    status: "ESCALATED",
    recoveredAmount: 0,
    history: [
      { timestamp: "2026-09-02T08:15:00Z", actor: "DETECTION_ENGINE", event: "Subscription renewal failed (₹1,45,000)" },
      { timestamp: "2026-09-02T08:15:02Z", actor: "LOCAL_ML_DIAGNOSIS", event: "Diagnosed as INSUFFICIENT_FUNDS / E-MANDATE CAP" },
      { timestamp: "2026-09-02T08:15:03Z", actor: "SAFETY_GUARDRAILS", event: "Triggered High-Value Safety Gate: Human Approval Required" }
    ]
  },
  {
    id: "REC-1046",
    customer: {
      name: "Kunal Singhania",
      email: "kunal_temp99@proton.me",
      phone: "+91 90011 22334",
      tier: "HIGH_RISK",
      lifetimeValue: 1200,
      historicalSuccessRate: 0.20,
      pastFailuresCount: 8,
      accountAgeMonths: 0.2
    },
    payment: {
      amount: 62000,
      currency: "INR",
      method: "DEBIT_CARD",
      bank: "SBI",
      rawErrorCode: "VELOCITY_LIMIT_BURST_SUSPICIOUS",
      errorCategory: "SUSPICIOUS_VELOCITY_RISK",
      eventType: "FAILED_PAYMENT",
      timestamp: "2026-09-02T07:40:00Z",
      checkoutDwellSeconds: 8
    },
    diagnosis: {
      rootCause: "SUSPICIOUS_VELOCITY_RISK",
      friendlyName: "Suspicious Card Velocity / Fraud Risk",
      confidence: 0.96,
      severity: "CRITICAL",
      description: "Brand new user attempted 8 rapid card transactions in under 2 minutes with disposable domain.",
      factors: [
        { name: "Multiple Rapid Declines (8 attempts)", impact: "+45%", type: "negative" },
        { name: "Disposable Email Domain", impact: "+35%", type: "negative" },
        { name: "Zero Established Customer History", impact: "+25%", type: "negative" }
      ]
    },
    decision: {
      recommendedAction: "STOP_RECOVERY",
      actionLabel: "Auto-Halt Recovery (Block Chargeback Risk)",
      recoveryProbability: 0.04,
      expectedRecoveryValue: 0,
      interventionCost: 0,
      channel: "SECURITY_FIREWALL",
      alternativeActions: [
        { action: "ESCALATE_HUMAN_REVIEW", label: "Flag to Fraud Risk Team", prob: 0.05, expValue: 0 }
      ]
    },
    guardrails: {
      maxRetriesAllowed: 0,
      retriesUsed: 0,
      cooldownMinutes: 9999,
      cooldownRemainingSeconds: 0,
      maxTouchpoints: 0,
      touchpointsUsed: 0,
      isHighValueEscalationRequired: false,
      isCooldownSatisfied: false,
      stoppingRuleHit: "SECURITY_STOPPING_RULE: Excessive Velocity / Fraud Risk",
      status: "HALTED_BY_SAFETY_POLICY"
    },
    status: "STOPPED",
    recoveredAmount: 0,
    history: [
      { timestamp: "2026-09-02T07:40:00Z", actor: "DETECTION_ENGINE", event: "Detected high-velocity card decline ₹62,000" },
      { timestamp: "2026-09-02T07:40:01Z", actor: "LOCAL_ML_DIAGNOSIS", event: "Identified SUSPICIOUS_VELOCITY_RISK (96% conf)" },
      { timestamp: "2026-09-02T07:40:02Z", actor: "SAFETY_GUARDRAILS", event: "Agent STOP rule triggered immediately to prevent chargeback penalty" }
    ]
  },
  {
    id: "REC-1047",
    customer: {
      name: "Sneha Reddy (Reddy Enterprises)",
      email: "finance@reddyent.com",
      phone: "+91 93344 55667",
      tier: "GOLD",
      lifetimeValue: 320000,
      historicalSuccessRate: 0.91,
      pastFailuresCount: 1,
      accountAgeMonths: 20
    },
    payment: {
      amount: 12500,
      currency: "INR",
      method: "INVOICE",
      bank: "N/A",
      rawErrorCode: "INVOICE_PAST_DUE_14_DAYS",
      errorCategory: "OVERDUE_INVOICE_NEGLECT",
      eventType: "OVERDUE_INVOICE",
      timestamp: "2026-09-02T06:00:00Z",
      checkoutDwellSeconds: 0
    },
    diagnosis: {
      rootCause: "OVERDUE_INVOICE_NEGLECT",
      friendlyName: "Overdue B2B Invoice (Admin Oversight)",
      confidence: 0.87,
      severity: "MEDIUM",
      description: "Invoice #INV-8891 reached 14 days overdue without view. Typical SME accounting cycle delay.",
      factors: [
        { name: "Verified B2B Business Profile", impact: "+30%", type: "positive" },
        { name: "Prior Invoices Paid Within 21 Days", impact: "+25%", type: "positive" },
        { name: "No Active Disputes Recorded", impact: "+20%", type: "positive" }
      ]
    },
    decision: {
      recommendedAction: "SEND_SMART_PAYMENT_LINK",
      actionLabel: "WhatsApp + Email 1-Click Payment Link",
      recoveryProbability: 0.89,
      expectedRecoveryValue: 11125,
      interventionCost: 3.0,
      channel: "OMNICHANNEL_INVOICE_LINK",
      alternativeActions: [
        { action: "SEND_WHATSAPP_REMINDER", label: "Executive WhatsApp Reminder", prob: 0.82, expValue: 10250 },
        { action: "ESCALATE_HUMAN_REVIEW", label: "Assign Account Executive Call", prob: 0.75, expValue: 9375 }
      ]
    },
    guardrails: {
      maxRetriesAllowed: 2,
      retriesUsed: 0,
      cooldownMinutes: 1440,
      cooldownRemainingSeconds: 0,
      maxTouchpoints: 3,
      touchpointsUsed: 0,
      isHighValueEscalationRequired: false,
      isCooldownSatisfied: true,
      stoppingRuleHit: null,
      status: "PASSED_ALL_SAFETY_CHECKS"
    },
    status: "ACTION_SCHEDULED",
    recoveredAmount: 0,
    history: [
      { timestamp: "2026-09-02T06:00:00Z", actor: "DETECTION_ENGINE", event: "Overdue Invoice detected (₹12,500)" },
      { timestamp: "2026-09-02T06:00:02Z", actor: "LOCAL_ML_DIAGNOSIS", event: "Diagnosed as OVERDUE_INVOICE_NEGLECT" }
    ]
  },
  {
    id: "REC-1048",
    customer: {
      name: "Meera Nair",
      email: "meera.nair@tech.co",
      phone: "+91 98112 33445",
      tier: "PLATINUM",
      lifetimeValue: 92000,
      historicalSuccessRate: 0.95,
      pastFailuresCount: 0,
      accountAgeMonths: 18
    },
    payment: {
      amount: 9900,
      currency: "INR",
      method: "UPI",
      bank: "AXIS_BANK",
      vpa: "meera@okhdfcbank",
      rawErrorCode: "INTERNAL_BANK_PROCESSING_ERROR",
      errorCategory: "GATEWAY_TIMEOUT",
      eventType: "FAILED_PAYMENT",
      timestamp: "2026-09-02T05:20:00Z",
      checkoutDwellSeconds: 35
    },
    diagnosis: {
      rootCause: "TEMPORARY_GATEWAY_DOWNTIME",
      friendlyName: "Axis Bank Internal Processing Glitch",
      confidence: 0.93,
      severity: "LOW",
      description: "Brief 30-second bank switch timeout resolved within 5 minutes.",
      factors: [
        { name: "Customer High Reliability (95%)", impact: "+35%", type: "positive" },
        { name: "Resolved Bank Outage Indicator", impact: "+30%", type: "positive" }
      ]
    },
    decision: {
      recommendedAction: "RETRY_IMMEDIATE",
      actionLabel: "Smart Cooldown Retry",
      recoveryProbability: 0.96,
      expectedRecoveryValue: 9504,
      interventionCost: 0,
      channel: "AUTO_PAYMENT_GATEWAY",
      alternativeActions: []
    },
    guardrails: {
      maxRetriesAllowed: 3,
      retriesUsed: 1,
      cooldownMinutes: 15,
      cooldownRemainingSeconds: 0,
      maxTouchpoints: 1,
      touchpointsUsed: 1,
      isHighValueEscalationRequired: false,
      isCooldownSatisfied: true,
      stoppingRuleHit: null,
      status: "RECOVERED_SUCCESSFULLY"
    },
    status: "RECOVERED",
    recoveredAmount: 9900,
    history: [
      { timestamp: "2026-09-02T05:20:00Z", actor: "DETECTION_ENGINE", event: "UPI failure detected (₹9,900)" },
      { timestamp: "2026-09-02T05:20:02Z", actor: "LOCAL_ML_DIAGNOSIS", event: "Diagnosed as TEMPORARY_GATEWAY_DOWNTIME" },
      { timestamp: "2026-09-02T05:20:03Z", actor: "POLICY_ENGINE", event: "Executed Smart Retry #1" },
      { timestamp: "2026-09-02T05:20:05Z", actor: "PAYMENT_SIMULATOR", event: "SUCCESS: Payment settled (₹9,900 recovered)" }
    ]
  }
];

export const INITIAL_AUDIT_LOGS = [
  {
    id: "AUD-991",
    timestamp: "2026-09-02T10:45:14Z",
    caseId: "REC-1042",
    actor: "POLICY_ENGINE",
    eventType: "ACTION_DECISION",
    details: "Selected RETRY_IMMEDIATE with 92% confidence based on high customer loyalty and transient 504 error.",
    safetyStatus: "ALL_RULES_PASSED",
    recoveryDelta: 0
  },
  {
    id: "AUD-990",
    timestamp: "2026-09-02T10:30:05Z",
    caseId: "REC-1043",
    actor: "SAFETY_GUARDRAIL",
    eventType: "GUARDRAIL_GATE",
    details: "Suppressed automated direct retry because root cause is 3DS OTP drop. Diverted to WhatsApp Smart Link.",
    safetyStatus: "DIRECT_RETRY_SUPPRESSED",
    recoveryDelta: 0
  },
  {
    id: "AUD-989",
    timestamp: "2026-09-02T08:15:03Z",
    caseId: "REC-1045",
    actor: "SAFETY_GUARDRAIL",
    eventType: "HIGH_VALUE_GATE",
    details: "Amount ₹1,45,000 exceeds ₹50,000 autonomous threshold. Routed to human account manager.",
    safetyStatus: "HELD_FOR_HUMAN_APPROVAL",
    recoveryDelta: 0
  },
  {
    id: "AUD-988",
    timestamp: "2026-09-02T07:40:02Z",
    caseId: "REC-1046",
    actor: "SAFETY_GUARDRAIL",
    eventType: "STOPPING_RULE_TRIGGERED",
    details: "High Velocity Risk detected (8 attempts in 120s). Automated recovery permanently halted.",
    safetyStatus: "STOPPED_SECURITY_PREVENTION",
    recoveryDelta: 0
  },
  {
    id: "AUD-987",
    timestamp: "2026-09-02T05:20:05Z",
    caseId: "REC-1048",
    actor: "AI_RECOVERY_AGENT",
    eventType: "REVENUE_RECOVERED",
    details: "Executed Smart Retry #1 on Axis Bank UPI. Transaction confirmed settled for ₹9,900.",
    safetyStatus: "RECOVERY_CONFIRMED",
    recoveryDelta: 9900
  }
];

export const ACTION_CONVERSION_ANALYTICS = [
  { action: "Immediate Smart Retry", attempts: 184, successes: 154, rate: 83.7, revenue: 452000, avgCost: 0 },
  { action: "Smart 1-Click Payment Link", attempts: 142, successes: 108, rate: 76.1, revenue: 312000, avgCost: 2.5 },
  { action: "WhatsApp AI Recovery Nudge", attempts: 96, successes: 65, rate: 67.7, revenue: 145000, avgCost: 1.8 },
  { action: "Optimal Payday Retry Window", attempts: 48, successes: 32, rate: 66.7, revenue: 84000, avgCost: 0 },
  { action: "Payment Method Switch (UPI Mandate)", attempts: 34, successes: 21, rate: 61.8, revenue: 56500, avgCost: 0 },
  { action: "Human Escalation Route", attempts: 12, successes: 10, rate: 83.3, revenue: 380000, avgCost: 45 }
];

export const ROOT_CAUSE_BREAKDOWN = [
  { cause: "Temporary Bank/Gateway Downtime", count: 78, percentage: 38.2, avgRecoveryRate: 88.5, color: "#FF6A00" },
  { cause: "3DS OTP Timeout / Dropout", count: 42, percentage: 20.6, avgRecoveryRate: 74.2, color: "#0066FF" },
  { cause: "Checkout Cart Abandonment", count: 35, percentage: 17.1, avgRecoveryRate: 68.0, color: "#8B5CF6" },
  { cause: "Insufficient Funds / Limit Cap", count: 28, percentage: 13.7, avgRecoveryRate: 59.4, color: "#F59E0B" },
  { cause: "Overdue B2B Invoice Neglect", count: 14, percentage: 6.9, avgRecoveryRate: 82.1, color: "#10B981" },
  { cause: "Suspicious Velocity / Fraud Risk", count: 7, percentage: 3.5, avgRecoveryRate: 0.0, color: "#EF4444" }
];
