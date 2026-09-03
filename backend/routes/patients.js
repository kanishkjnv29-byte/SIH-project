import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticate } from '../middleware/auth.js';
import { triageModel, buildTriagePrompt, parseTriageResponse } from '../lib/geminiClient.js';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  const { name, age, gender, phone, village, symptoms } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (typeof symptoms !== 'string' || !symptoms.trim()) {
    return res.status(400).json({ error: 'Symptoms are required' });
  }

  const { data: inserted, error } = await supabase
    .from('patients')
    .insert({
      name: name.trim(),
      age: age || null,
      gender: gender || null,
      phone: phone || null,
      village: village || null,
      symptoms: symptoms.trim(),
      created_by: req.worker.id,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Patient insert error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.status(201).json(inserted);
});

router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('patients')
    .select('*, created_by_worker:health_workers(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Patients list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const patients = data.map(({ created_by_worker, ...patient }) => ({
    ...patient,
    created_by_name: created_by_worker?.name || null,
  }));

  return res.json(patients);
});

router.get('/:id', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('patients')
    .select('*, created_by_worker:health_workers(name)')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) {
    console.error('Patient detail error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!data) {
    return res.status(404).json({ error: 'Patient not found.' });
  }

  const { created_by_worker, ...patient } = data;
  return res.json({ ...patient, created_by_name: created_by_worker?.name || null });
});

router.post('/:id/triage', authenticate, async (req, res) => {
  const { id } = req.params;

  const { data: patient, error: fetchError } = await supabase
    .from('patients')
    .select('id, age, gender, symptoms')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('Triage fetch error:', fetchError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found.' });
  }

  const prompt = buildTriagePrompt(patient);

  let triage = null;
  for (let attempt = 0; attempt < 2 && !triage; attempt++) {
    try {
      const result = await triageModel.generateContent(prompt);
      triage = parseTriageResponse(result.response.text());
    } catch (err) {
      console.error('Gemini call error:', err.message);
    }
  }

  if (!triage) {
    return res.status(502).json({ error: 'AI triage could not be completed right now. Please try again.' });
  }

  const { data: updated, error: updateError } = await supabase
    .from('patients')
    .update({
      urgency_level: triage.urgency_level,
      triage_reason: triage.reason,
      triaged_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, created_by_worker:health_workers(name)')
    .single();

  if (updateError) {
    console.error('Triage update error:', updateError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const { created_by_worker, ...patientData } = updated;
  return res.json({ ...patientData, created_by_name: created_by_worker?.name || null });
});

router.get('/:id/referrals', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('referrals')
    .select(
      '*, facility:facilities(name, type), referred_by_worker:health_workers(name), follow_ups(status, due_date, notes, completed_at)'
    )
    .eq('patient_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Patient referrals list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const referrals = data.map(({ facility, referred_by_worker, follow_ups, ...referral }) => {
    const followUp = Array.isArray(follow_ups) ? follow_ups[0] : follow_ups;
    return {
      ...referral,
      facility_name: facility?.name || null,
      facility_type: facility?.type || null,
      referred_by_name: referred_by_worker?.name || null,
      follow_up_status: followUp?.status || null,
      follow_up_due_date: followUp?.due_date || null,
      follow_up_notes: followUp?.notes || null,
      follow_up_completed_at: followUp?.completed_at || null,
    };
  });

  return res.json(referrals);
});

export default router;
