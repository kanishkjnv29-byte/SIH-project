import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticatePatient } from '../middleware/patientAuth.js';
import { runSchemeCheck } from '../lib/geminiClient.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

const REPORT_BUCKET = 'patient-reports';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/:patientId', authenticatePatient, asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  if (!UUID_RE.test(patientId)) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select(
      'id, name, age, gender, village, phone, urgency_level, triage_reason, triaged_at, abha_id, scheme_suggestion, scheme_checked_at'
    )
    .eq('id', patientId)
    .maybeSingle();

  if (patientError) {
    console.error('Patient portal lookup error:', patientError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  if (!patient || patient.phone !== req.patient.phone) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  const { phone, ...patientData } = patient;

  const { data: referralsData, error: referralsError } = await supabase
    .from('referrals')
    .select('*, facility:facilities(name, type), follow_ups(status, due_date, completed_at)')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (referralsError) {
    console.error('Patient portal referrals error:', referralsError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const referrals = referralsData.map(({ facility, follow_ups, patient_id, referred_by, facility_id, ...referral }) => {
    const followUp = Array.isArray(follow_ups) ? follow_ups[0] : follow_ups;
    return {
      ...referral,
      facility_name: facility?.name || null,
      facility_type: facility?.type || null,
      follow_up_status: followUp?.status || null,
      follow_up_due_date: followUp?.due_date || null,
      follow_up_completed_at: followUp?.completed_at || null,
    };
  });

  const { data: reportsData, error: reportsError } = await supabase
    .from('patient_reports')
    .select('id, ai_summary, created_at, storage_path')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (reportsError) {
    console.error('Patient portal reports error:', reportsError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const reports = await Promise.all(
    reportsData.map(async ({ storage_path, ...report }) => {
      const { data: signedUrlData, error: signError } = await supabase.storage
        .from(REPORT_BUCKET)
        .createSignedUrl(storage_path, SIGNED_URL_TTL_SECONDS);

      if (signError) {
        console.error('Signed URL error:', signError.message);
      }

      return { ...report, signed_url: signedUrlData?.signedUrl || null };
    })
  );

  return res.json({ patient: patientData, referrals, reports });
}));

router.post('/:patientId/scheme-check', authenticatePatient, asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  if (!UUID_RE.test(patientId)) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  const { data: patient, error: fetchError } = await supabase
    .from('patients')
    .select('id, age, symptoms, urgency_level, triage_reason, phone')
    .eq('id', patientId)
    .maybeSingle();

  if (fetchError) {
    console.error('Patient portal scheme check fetch error:', fetchError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  if (!patient || patient.phone !== req.patient.phone) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  if (!patient.urgency_level) {
    return res.json({
      scheme_suggestion: null,
      scheme_checked_at: null,
      message: "Your health worker hasn't completed a check-up yet — ask them at your next visit.",
    });
  }

  let schemeSuggestion;
  try {
    schemeSuggestion = await runSchemeCheck(patient);
  } catch (err) {
    console.error('Patient portal Gemini scheme check error:', err.message);
    return res.status(502).json({ error: 'Could not check scheme benefits right now. Please try again.' });
  }

  const scheme_checked_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('patients')
    .update({
      scheme_suggestion: schemeSuggestion,
      scheme_checked_at,
    })
    .eq('id', patientId);

  if (updateError) {
    console.error('Patient portal scheme check update error:', updateError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.json({ scheme_suggestion: schemeSuggestion, scheme_checked_at });
}));

export default router;
