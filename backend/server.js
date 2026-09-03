import 'dotenv/config';
import './lib/ensureJwtSecret.js';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import patientsRouter from './routes/patients.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/patients', patientsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
