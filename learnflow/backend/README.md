# LearnFlow AI — Backend

TypeScript/Express backend for LearnFlow AI.

## Prerequisites

- Node.js >= 18
- A Google Gemini API key
- (Optional) Weights & Biases API key for experiment logging

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Server will start on `http://localhost:$PORT` (default `8080`).

## Endpoints

### Health
- `GET /health`

### Chat
- `POST /api/chat`

Request body:
```json
{
  "message": "Explain photosynthesis",
  "depth_level": "Core",
  "mode": "Learning"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "answer": "...",
    "follow_up_questions": ["..."],
    "meta": {
      "depth_level": "Core",
      "mode": "Learning",
      "tokens": {"input": 0, "output": 0},
      "ethics": {"flags": []}
    }
  }
}
```

### Assignments
- `POST /api/assignment/generate`
- `POST /api/assignment/evaluate`

Generate request:
```json
{ "topic": "Pythagorean theorem", "depth_level": "Applied" }
```

Evaluate request:
```json
{
  "assignment": { "id": "...", "topic": "...", "depth_level": "Core", "prompt": "...", "expected_concepts": ["..."], "hints": ["..."], "rubric": ["..."] },
  "student_response": "My attempt..."
}
```

## Dashboard (Phase 8)

All dashboard endpoints are **read-only** and return **anonymized, aggregated** metrics.

### Role-based access (simple header RBAC)

- Teachers: `x-role: teacher`
- Institutions/auditors: `x-role: institution`

### Optional anonymous user/session header (recommended)

To get accurate active-student counts and depth progression trends, send a pseudonymous identifier:

- `x-anon-student-id: <random-id>` (recommended)

The backend hashes this value using `ANONYMIZATION_SALT` before writing telemetry.

### Endpoints

- `GET /api/dashboard/teacher?period=day|week|month`
- `GET /api/dashboard/institution?period=day|week|month`
- `GET /api/dashboard/metrics/:period`
- `GET /api/dashboard/topic/:topicName?period=day|week|month`
- `GET /api/dashboard/system-health`
- `GET /api/dashboard/ethics-report?period=day|week|month`

## Production build

```bash
npm run build
npm start
```
