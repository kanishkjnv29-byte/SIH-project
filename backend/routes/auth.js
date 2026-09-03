import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabaseClient.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const VALID_ROLES = ['ASHA', 'ANM', 'PHC_DOCTOR'];

const OTP_TTL_MS = 5 * 60 * 1000;
const otpStore = new Map();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/signup', async (req, res) => {
  const { aadhaar_number, password, name, role, facility_name } = req.body || {};

  if (typeof aadhaar_number !== 'string' || !/^\d{12}$/.test(aadhaar_number)) {
    return res.status(400).json({ error: 'Aadhaar number must be exactly 12 digits' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `Role must be one of ${VALID_ROLES.join(', ')}` });
  }

  const { data: existing, error: lookupError } = await supabase
    .from('health_workers')
    .select('id')
    .eq('aadhaar_number', aadhaar_number)
    .maybeSingle();

  if (lookupError) {
    console.error('Signup lookup error:', lookupError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (existing) {
    return res.status(409).json({ error: 'An account with this Aadhaar number already exists' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data: inserted, error: insertError } = await supabase
    .from('health_workers')
    .insert({ aadhaar_number, password_hash, name: name.trim(), role, facility_name: facility_name || null })
    .select('id, name')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return res.status(409).json({ error: 'An account with this Aadhaar number already exists' });
    }
    console.error('Signup insert error:', insertError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.status(201).json({
    message: 'Account created successfully',
    id: inserted.id,
    name: inserted.name,
  });
});

router.post('/login', async (req, res) => {
  const { aadhaar_number, password } = req.body || {};

  if (typeof aadhaar_number !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Aadhaar number and password are required' });
  }

  const { data: worker, error } = await supabase
    .from('health_workers')
    .select('id, name, role, facility_name, password_hash')
    .eq('aadhaar_number', aadhaar_number)
    .maybeSingle();

  if (error) {
    console.error('Login lookup error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!worker) {
    return res.status(401).json({ error: 'Incorrect Aadhaar number or password.' });
  }

  const passwordMatches = await bcrypt.compare(password, worker.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Incorrect Aadhaar number or password.' });
  }

  const otp = generateOtp();
  otpStore.set(aadhaar_number, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    worker: { id: worker.id, name: worker.name, role: worker.role, facility_name: worker.facility_name },
  });

  return res.json({
    message: 'Password verified. Enter the verification code to finish logging in.',
    demo_otp: otp,
    demo_note: 'DEMO MODE: In the real app this code would be sent by SMS. It is shown here because SMS delivery is not set up yet.',
  });
});

router.post('/verify-otp', async (req, res) => {
  const { aadhaar_number, otp } = req.body || {};

  if (typeof aadhaar_number !== 'string' || typeof otp !== 'string') {
    return res.status(400).json({ error: 'Aadhaar number and verification code are required' });
  }

  const entry = otpStore.get(aadhaar_number);
  if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
    return res.status(401).json({ error: 'That code is invalid or has expired. Please try logging in again.' });
  }

  otpStore.delete(aadhaar_number);

  const token = jwt.sign(
    { id: entry.worker.id, name: entry.worker.name, role: entry.worker.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    id: entry.worker.id,
    name: entry.worker.name,
    role: entry.worker.role,
    facility_name: entry.worker.facility_name,
  });
});

router.get('/me', authenticate, async (req, res) => {
  const { data: worker, error } = await supabase
    .from('health_workers')
    .select('id, name, role, facility_name')
    .eq('id', req.worker.id)
    .maybeSingle();

  if (error) {
    console.error('Me lookup error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!worker) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  return res.json(worker);
});

export default router;
