# LearnFlow AI — Teacher/Institution Dashboard (Phase 8)

A dedicated Next.js dashboard for **teachers** and **institutional auditors** to review anonymized learning trends, AI usage analytics, ethical compliance signals, and system health.

- Frontend: Next.js + TypeScript + Recharts
- Backend API: `learnflow/backend` (Express + TypeScript)
- Default dashboard port: `http://localhost:3001`

## Prerequisites

- Node.js >= 18
- Backend running (default: `http://localhost:8080`)

## Setup

```bash
cd learnflow-dashboard
npm install
npm run dev
```

## Environment

Optionally set the backend URL:

```bash
export NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

## Role access

This dashboard uses a lightweight header-based role for development/demo purposes:

- Teacher pages send `x-role: teacher`
- Institution pages send `x-role: institution`

## Data privacy

The dashboard **never** displays student identifiers. The backend only returns aggregated, anonymized metrics.

To get accurate active-student counts and depth progression trends, the calling client (e.g. LearnFlow student UI) should send:

- `x-anon-student-id: <pseudonymous-id>`

The backend hashes the value (salted) before writing telemetry.
