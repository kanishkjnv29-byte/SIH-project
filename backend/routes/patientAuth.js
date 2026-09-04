import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabaseClient.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const otpStore = new Map();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/request-otp', asyncHandler(async (req, res) => {
  const { phone } = req.body || {};

  if (typeof phone !== 'string' || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
  }

  const { data: patients, error } = await supabase
    .from('patients')
    .select('id')
    .eq('phone', phone);

  if (error) {
    console.error('Patient phone lookup error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  // Always respond the same way whether or not the phone is registered, so the
  // response can't be used to enumerate which phone numbers exist in the system.
  const otp = generateOtp();
  if (patients && patients.length > 0) {
    otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });
  }

  return res.json({
    message: 'If this phone number is registered, a verification code has been sent.',
    demo_otp: otp,
    demo_note: 'DEMO MODE: In the real app this code would be sent by SMS. It is shown here because SMS delivery is not set up yet.',
  });
}));

router.post('/verify-otp', asyncHandler(async (req, res) => {
  const { phone, otp } = req.body || {};

  if (typeof phone !== 'string' || typeof otp !== 'string') {
    return res.status(400).json({ error: 'Phone number and verification code are required' });
  }

  const entry = otpStore.get(phone);
  if (!entry || Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return res.status(401).json({ error: 'That code is invalid or has expired. Please try again.' });
  }

  if (entry.attempts >= MAX_OTP_ATTEMPTS) {
    otpStore.delete(phone);
    return res.status(401).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }

  if (entry.otp !== otp) {
    entry.attempts += 1;
    return res.status(401).json({ error: 'That code is invalid or has expired. Please try again.' });
  }

  otpStore.delete(phone);

  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, name, age, village')
    .eq('phone', phone);

  if (error) {
    console.error('Patient phone lookup error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  if (!patients || patients.length === 0) {
    return res.status(404).json({ error: 'No records found for this phone number.' });
  }

  const token = jwt.sign({ type: 'patient', phone }, process.env.JWT_SECRET, { expiresIn: '8h' });

  return res.json({ token, patients });
}));

export default router;
