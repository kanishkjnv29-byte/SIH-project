# Gram Swasthya

A rural healthcare referral tracking system for ASHA, ANM and PHC health workers — built for **SIH26133** (Government of Maharashtra).

## What this does

When a rural patient is referred up the care chain — Sub-Centre → PHC → CHC → District Hospital — Gram Swasthya tracks that referral end to end instead of letting it disappear into a paper trail. Every referral automatically creates a follow-up task for the health worker who made it. When a patient's status is later updated further up the chain (e.g. the District Hospital marks their case Completed), a follow-up notification cascades back down through every health worker involved in that patient's chain, so nobody is left wondering what happened after they handed a patient off.

## Features

- **Health worker auth** — Aadhaar number + password, with a demo one-time code step on top (SMS is stubbed for the hackathon; the code is returned in the API response instead of being texted)
- **Patient intake** with multilingual voice input for symptoms (Hindi, Marathi, English)
- **AI-assisted triage** — Gemini scores urgency (Low/Medium/High/Emergency) with a plain-language reason, as a decision-support suggestion for the health worker
- **AI-read report uploads** — photos of prescriptions/reports are summarized by Gemini for a quick read
- **Facility directory & map** — Leaflet map of nearby facilities with live medicine, staff and equipment availability
- **Referral creation with chain-linked cascading follow-ups** — referrals link back to the previous one in a patient's chain, so a status update cascades a follow-up to every prior worker
- **Stats dashboard** — total patients/referrals, urgency and referral-status breakdowns, this worker's pending follow-ups
- **Patient Portal** — a separate phone number + OTP login where patients can check their own referral history, triage result, and reports, independent of the health worker login
- **Mock ABHA ID** — a simulated Ayushman Bharat Health Account ID generated per patient
- **Ayushman Bharat (PM-JAY) awareness check** — Gemini-assisted, plain-language explanation of whether a patient's situation looks like the kind of care PM-JAY typically covers (not an eligibility determination)
- **Full Hindi/English toggle** across the health worker app and the Patient Portal

## Tech stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database & storage:** Supabase (Postgres + Storage)
- **AI:** Google Gemini (`gemini-3.5-flash`) for triage, report summarization, and the PM-JAY awareness check
- **Maps:** Leaflet / react-leaflet
- **Auth:** JWT (separate token types for health workers and patients)
- **i18n:** i18next / react-i18next

## Demo data notes

This is a hackathon-scope build — a few things are deliberately simplified rather than fully real:

- **Aadhaar numbers are not verified** against any government system — they're collected and stored only as a unique 12-digit account identifier.
- **Facility coordinates** (Gorakhpur district) use real block and village names, but the map coordinates are approximate placements, not surveyed GPS points.
- **Facility phone numbers** are placeholder values, not working numbers.
- **The ABHA ID is simulated** — a locally-generated mock ID, not a real Ayushman Bharat Digital Mission integration (which requires government certification).

## Setup

### Prerequisites

- Node.js 18+ and npm
- A Supabase project

### Supabase setup

Create these tables in your Supabase project: `health_workers`, `patients`, `facilities`, `facility_medicines`, `facility_staff`, `facility_equipment`, `referrals`, `follow_ups`, `patient_reports`.

Create a Storage bucket named `patient-reports` (used to store uploaded prescription/report images; the backend generates 1-hour signed URLs to serve them).

### Environment variables

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
cp .env.example .env
```

Then fill in `backend/.env`:

| Variable | Notes |
| --- | --- |
| `PORT` | Defaults to `5000` if unset |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key (server-side only — never expose to the frontend) |
| `JWT_SECRET` | Auto-generated and saved to `.env` on first run if left unset |
| `GEMINI_API_KEY` | Google Gemini API key, used for triage, report summaries, and the PM-JAY check |

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
