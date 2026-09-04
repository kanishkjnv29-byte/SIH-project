import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

const URGENCY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
const REFERRAL_STATUSES = ['PENDING', 'ACKNOWLEDGED', 'COMPLETED'];

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const [
    { count: total_patients, error: patientsError },
    { count: total_referrals, error: referralsError },
    { count: my_pending_followups, error: followUpsError },
    { data: triagedPatients, error: triagedError },
    { data: allReferrals, error: referralStatusError },
  ] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }).eq('created_by', req.worker.id),
    supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referred_by', req.worker.id),
    supabase
      .from('follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', req.worker.id)
      .eq('status', 'PENDING'),
    supabase
      .from('patients')
      .select('urgency_level')
      .not('urgency_level', 'is', null)
      .eq('created_by', req.worker.id),
    supabase.from('referrals').select('status').eq('referred_by', req.worker.id),
  ]);

  const error = patientsError || referralsError || followUpsError || triagedError || referralStatusError;
  if (error) {
    console.error('Stats error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const urgency_breakdown = Object.fromEntries(URGENCY_LEVELS.map((level) => [level, 0]));
  for (const patient of triagedPatients) {
    if (urgency_breakdown[patient.urgency_level] !== undefined) {
      urgency_breakdown[patient.urgency_level] += 1;
    }
  }

  const referral_status_breakdown = Object.fromEntries(REFERRAL_STATUSES.map((status) => [status, 0]));
  for (const referral of allReferrals) {
    if (referral_status_breakdown[referral.status] !== undefined) {
      referral_status_breakdown[referral.status] += 1;
    }
  }

  return res.json({
    total_patients: total_patients || 0,
    total_referrals: total_referrals || 0,
    my_pending_followups: my_pending_followups || 0,
    urgency_breakdown,
    referral_status_breakdown,
  });
}));

export default router;
