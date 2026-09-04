import 'dotenv/config';
import './lib/ensureJwtSecret.js';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import patientsRouter from './routes/patients.js';
import facilitiesRouter from './routes/facilities.js';
import referralsRouter from './routes/referrals.js';
import followUpsRouter from './routes/followUps.js';
import statsRouter from './routes/stats.js';
import patientAuthRouter from './routes/patientAuth.js';
import patientPortalRouter from './routes/patientPortal.js';
import { errorHandler } from './middleware/errorHandler.js';

// Last line of defense: a bug that escapes every route handler and every
// try/catch should never take the whole server down. Log it and keep serving.
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, err);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[${new Date().toISOString()}] Unhandled Rejection:`, reason);
});

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Gram Swasthya API is running');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/facilities', facilitiesRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/follow-ups', followUpsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/patient-auth', patientAuthRouter);
app.use('/api/patient-portal', patientPortalRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
