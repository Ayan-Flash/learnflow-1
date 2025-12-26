# LearnFlow AI

A depth-driven educational AI system with ethical assignment support.

## Repo structure

```
learnflow/
  backend/   # Express + TypeScript + Gemini + W&B logging
  frontend/  # Next.js + TypeScript + Tailwind UI
```

## Quickstart (local)

### 1) Backend

```bash
cd learnflow/backend
cp .env.example .env
# Fill GOOGLE_API_KEY (required). WANDB_* are optional.
npm install
npm run dev
```

Backend: `http://localhost:8080`

### 2) Frontend

```bash
cd learnflow/frontend
npm install
# Optionally set NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
npm run dev
```

Frontend: `http://localhost:3000`
