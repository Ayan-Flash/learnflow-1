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

## Production build

```bash
npm run build
npm start
```
