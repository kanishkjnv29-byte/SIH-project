# sih-referral-solo

A full-stack app scaffold with a separate frontend and backend.

## Structure

- **`frontend/`** — React app built with Vite (JavaScript). Runs on `http://localhost:5173` in dev.
- **`backend/`** — Express API server. Exposes `GET /api/health` and runs on the port set in `backend/.env` (defaults to `5000`).

## Prerequisites

- Node.js 18+ and npm

## Setup

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
cp .env.example .env
```

## Running

Open two terminals from the project root:

```bash
# Terminal 1 — backend
cd backend
npm run dev
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend health check: http://localhost:5000/api/health → `{ "status": "ok" }`
