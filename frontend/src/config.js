// Single source of truth for the backend's base URL. Set VITE_API_URL in
// production (e.g. on Vercel) to point at the deployed backend; falls back
// to the local dev server otherwise.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
