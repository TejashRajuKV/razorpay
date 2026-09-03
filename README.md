# AI Revenue Recovery Agent

## Razorpay AI Buildathon — Track 03: AI Revenue Recovery

A bounded AI-powered Revenue Recovery Agent that identifies revenue at risk, diagnoses the cause, selects appropriate recovery actions, executes bounded workflows, and measures recovered money.

---

## Project Overview

This project implements a complete **Detect → Diagnose → Decide → Act → Observe → Measure** loop for recovering lost revenue from failed payments, abandoned checkouts, and other revenue-at-risk events.

### Key Features
- **Revenue Risk Detection**: Identify payments likely to result in lost revenue
- **AI Root-Cause Diagnosis**: Classify failure reasons (temporary, repeated, data issues, abandonment)
- **Recovery Action Selection**: Choose optimal intervention (retry, reminder, payment link, escalate)
- **Bounded Execution**: Safety rules, retry limits, cooldown periods
- **Audit Trail**: Complete logging of all decisions and actions
- **Payment Simulator**: Synthetic data generation for testing without external APIs
- **Local ML Engine**: Rule-based models (no external LLM dependencies)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React.js |
| Backend | Node.js + Express.js |
| Database | SQLite (dev) / PostgreSQL (prod) |
| AI/ML | Python + scikit-learn (local) |
| Simulator | JavaScript (built-in) |

---

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Python >= 3.9
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Initialize database and seed data
npm run seed

# Start server
npm run dev
```

### ML Service Setup

```bash
cd ml

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start ML service
python app.py
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment config (already created)
# cp .env.example .env

# Start development server (runs on http://localhost:5173)
npm run dev
```

---

## Frontend-Backend Connection

The frontend is now connected to the backend via a REST API service layer:

- **API Base URL**: `http://localhost:3001/api/v1` (configurable via `VITE_API_URL` in `.env`)
- **Health Check**: Automatically checks backend connectivity on app load
- **Fallback Mode**: If backend is unavailable, frontend gracefully falls back to mock data
- **API Service**: Located at `frontend/src/services/api.js`

### How It Works

1. **On App Load**: The frontend automatically pings the backend health endpoint
2. **If Connected**: Fetches real data from backend APIs and syncs state
3. **If Disconnected**: Falls back to local mock data seamlessly
4. **User Actions**: Recovery actions, batch simulations, and scenario injections are sent to the backend when available

### Running Both Servers

Open two terminals:

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:5173
```

---

## API Endpoints

### Dashboard
- `GET /api/v1/dashboard/overview` - Main metrics
- `GET /api/v1/dashboard/revenue-at-risk` - Risk breakdown
- `GET /api/v1/dashboard/customer-segments` - Segment analysis

### Recovery Cases
- `GET /api/v1/cases` - List all cases
- `GET /api/v1/cases/:id` - Case details
- `POST /api/v1/cases/:id/action` - Execute action
- `POST /api/v1/cases/:id/run-workflow` - Run AI workflow
- `GET /api/v1/cases/:id/audit` - Audit trail

### Recovery Workflow
- `POST /api/v1/recovery/detect` - Detect at-risk payments
- `POST /api/v1/recovery/run-batch` - Batch recovery
- `POST /api/v1/recovery/simulate-batch` - Simulate recovery
- `GET /api/v1/recovery/stats` - Recovery statistics

### Analytics
- `GET /api/v1/analytics/overview` - Analytics overview
- `GET /api/v1/analytics/by-action` - Action performance
- `GET /api/v1/analytics/trends` - Recovery trends

### Audit
- `GET /api/v1/audit/logs` - Audit logs
- `GET /api/v1/audit/case/:id` - Case audit trail
- `GET /api/v1/audit/export` - Export for compliance

### Simulator
- `POST /api/v1/simulator/generate` - Generate synthetic data
- `POST /api/v1/simulator/seed-db` - Seed database
- `POST /api/v1/simulator/test-action` - Test single action

---

## Project Structure

```
ai-revenue-recovery/
├── frontend/              # React dashboard
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
├── backend/               # Node.js API server
│   ├── src/
│   │   ├── config/       # Database config
│   │   ├── controllers/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── app.js        # Entry point
│   └── package.json
├── ml/                    # Python ML service
│   ├── src/
│   │   ├── risk_model.py
│   │   ├── diagnosis_model.py
│   │   └── recovery_model.py
│   ├── app.py            # Flask API server
│   └── requirements.txt
├── database/
│   ├── schema.sql        # Database schema
│   └── seed.sql          # Seed data
├── simulator/             # Payment simulator
└── docs/                 # Documentation
```

---

## Core Product Loop

```
Revenue at Risk 
    ↓
Detect (identify failed/abandoned payments)
    ↓
Diagnose (classify root cause via ML)
    ↓
Decide (select best recovery action)
    ↓
Act (execute bounded action with safety checks)
    ↓
Observe (record outcome)
    ↓
Measure (calculate recovered revenue)
    ↓
Audit (log all decisions)
```

---

## Safety & Bounds

All automated actions are constrained by:
- **Maximum retry attempts** per case (default: 3)
- **Cooldown periods** between retries (default: 60 minutes)
- **Maximum total recovery attempts** (default: 5)
- **High-value escalation** (cases > ₹50,000 with low confidence require human review)
- **Stopping rules** when recovery probability drops below threshold

---

## Recovery Actions

| Action | Description | Best For |
|--------|-------------|----------|
| `retry` | Immediate payment retry | Temporary failures |
| `reminder` | Send payment reminder | Abandonment, low urgency |
| `payment_link` | Generate payment link | Data issues, convenience |
| `retry_later` | Scheduled retry | Timeout errors |
| `escalate` | Human review | High-value, low confidence |
| `stop` | Cease recovery | Repeated failures, max attempts |

---

## Key Metrics

- **Revenue at Risk**: Total value identified as potentially lost
- **Recovered Revenue**: Total value successfully recovered
- **Recovery Rate**: (Recovered ÷ At Risk) × 100
- **Action Success Rate**: Successful recoveries ÷ executed actions
- **Cases Processed**: Number of cases analyzed

---

## Demo Flow (5-Minute Video)

1. Show merchant dashboard with revenue metrics
2. Open at-risk cases list
3. Select high-value failed payment
4. Display AI diagnosis and factors
5. Show recommended action with safety check
6. Execute simulated recovery
7. Display successful outcome and recovered amount
8. Show audit trail proving agent actions
9. Run batch simulation showing aggregate results
10. Explain closed-loop recovery system

---

## License

MIT License - See LICENSE file for details

---

## Team

Built for Razorpay AI Buildathon Track 03
