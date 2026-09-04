import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

const VALID_REFERRAL_STATUSES = ['ACKNOWLEDGED', 'COMPLETED'];

function addDaysAsDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { patient_id, facility_id, reason } = req.body || {};

  if (typeof patient_id !== 'string' || !patient_id.trim()) {
    return res.status(400).json({ error: 'A patient is required' });
  }
  if (typeof facility_id !== 'string' || !facility_id.trim()) {
    return res.status(400).json({ error: 'A facility is required' });
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'Reason for referral is required' });
  }
  if (reason.trim().length > 1000) {
    return res.status(400).json({ error: 'Reason must be 1000 characters or fewer' });
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patient_id)
    .maybeSingle();

  if (patientError) {
    console.error('Referral patient lookup error:', patientError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found.' });
  }

  const { data: facility, error: facilityError } = await supabase
    .from('facilities')
    .select('id')
    .eq('id', facility_id)
    .maybeSingle();

  if (facilityError) {
    console.error('Referral facility lookup error:', facilityError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!facility) {
    return res.status(404).json({ error: 'Facility not found.' });
  }

  const { data: priorReferral, error: priorError } = await supabase
    .from('referrals')
    .select('id')
    .eq('patient_id', patient_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorError) {
    console.error('Referral chain lookup error:', priorError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('referrals')
    .insert({
      patient_id,
      facility_id,
      referred_by: req.worker.id,
      reason: reason.trim(),
      previous_referral_id: priorReferral?.id || null,
    })
    .select('*, facility:facilities(name, type)')
    .single();

  if (insertError) {
    console.error('Referral insert error:', insertError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const { error: followUpError } = await supabase.from('follow_ups').insert({
    referral_id: inserted.id,
    assigned_to: req.worker.id,
    due_date: addDaysAsDateString(3),
    status: 'PENDING',
  });

  if (followUpError) {
    console.error('Follow-up auto-create error:', followUpError.message);
  }

  const { facility: facilityData, ...referral } = inserted;
  return res.status(201).json({
    ...referral,
    facility_name: facilityData?.name || null,
    facility_type: facilityData?.type || null,
    referral_created: true,
    followup_created: !followUpError,
  });
}));

router.patch('/:id/status', authenticate, asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  const { id } = req.params;

  if (!VALID_REFERRAL_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of ${VALID_REFERRAL_STATUSES.join(', ')}` });
  }

  const { data: updated, error } = await supabase
    .from('referrals')
    .update({ status })
    .eq('id', id)
    .select('*, facility:facilities(name, type)')
    .maybeSingle();

  if (error) {
    console.error('Referral status update error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!updated) {
    return res.status(404).json({ error: 'Referral not found.' });
  }

  if (status === 'COMPLETED') {
    const facilityName = updated.facility?.name || null;
    const today = addDaysAsDateString(0);

    let previousId = updated.previous_referral_id;
    while (previousId) {
      const { data: earlierReferral, error: earlierError } = await supabase
        .from('referrals')
        .select('id, referred_by, previous_referral_id')
        .eq('id', previousId)
        .maybeSingle();

      if (earlierError || !earlierReferral) {
        console.error('Referral chain walk error:', earlierError?.message);
        break;
      }

      const { error: cascadeError } = await supabase.from('follow_ups').insert({
        referral_id: earlierReferral.id,
        assigned_to: earlierReferral.referred_by,
        due_date: today,
        status: 'PENDING',
        source: 'CASCADE_UPDATE',
        cascade_facility_name: facilityName,
      });

      if (cascadeError) {
        console.error('Cascade follow-up insert error:', cascadeError.message);
      }

      previousId = earlierReferral.previous_referral_id;
    }
  }

  const { facility: facilityData, ...referral } = updated;
  return res.json({
    ...referral,
    facility_name: facilityData?.name || null,
    facility_type: facilityData?.type || null,
  });
}));

export default router;
