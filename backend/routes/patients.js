import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabaseClient.js';
import { authenticate } from '../middleware/auth.js';
import {
  triageModel,
  buildTriagePrompt,
  parseTriageResponse,
  reportSummaryModel,
  buildReportSummaryPrompt,
  schemeCheckModel,
  buildSchemeCheckPrompt,
  PMJAY_VERIFICATION_NOTE,
} from '../lib/geminiClient.js';

const router = Router();

const REPORT_BUCKET = 'patient-reports';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function generateMockAbhaId() {
  const digits = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('');
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG images are allowed'));
    }
  },
});

router.post('/', authenticate, async (req, res) => {
  const { name, age, gender, phone, village, symptoms } = req.body || {};

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (typeof symptoms !== 'string' || !symptoms.trim()) {
    return res.status(400).json({ error: 'Symptoms are required' });
  }
  if (symptoms.trim().length > 1000) {
    return res.status(400).json({ error: 'Symptoms must be 1000 characters or fewer' });
  }

  let ageValue = null;
  if (age !== undefined && age !== null && age !== '') {
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120) {
      return res.status(400).json({ error: 'Age must be a whole number between 0 and 120' });
    }
    ageValue = ageNum;
  }

  if (phone !== undefined && phone !== null && phone !== '' && !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
  }

  const { data: inserted, error } = await supabase
    .from('patients')
    .insert({
      name: name.trim(),
      age: ageValue,
      gender: gender || null,
      phone: phone || null,
      village: village || null,
      symptoms: symptoms.trim(),
      created_by: req.worker.id,
      abha_id: generateMockAbhaId(),
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

router.post('/:id/scheme-check', authenticate, async (req, res) => {
  const { id } = req.params;

  const { data: patient, error: fetchError } = await supabase
    .from('patients')
    .select('id, age, symptoms, urgency_level, triage_reason')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('Scheme check fetch error:', fetchError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found.' });
  }

  const prompt = buildSchemeCheckPrompt(patient);

  let note;
  try {
    const result = await schemeCheckModel.generateContent(prompt);
    note = result.response.text().trim();
  } catch (err) {
    console.error('Gemini scheme check error:', err.message);
    return res.status(502).json({ error: 'Could not check scheme benefits right now. Please try again.' });
  }

  if (!note) {
    return res.status(502).json({ error: 'Could not check scheme benefits right now. Please try again.' });
  }

  const schemeSuggestion = `${note} ${PMJAY_VERIFICATION_NOTE}`;

  const { data: updated, error: updateError } = await supabase
    .from('patients')
    .update({
      scheme_suggestion: schemeSuggestion,
      scheme_checked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, created_by_worker:health_workers(name)')
    .single();

  if (updateError) {
    console.error('Scheme check update error:', updateError.message);
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

router.post(
  '/:id/reports',
  authenticate,
  (req, res, next) => {
    upload.single('report')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Invalid file upload' });
      }
      next();
    });
  },
  async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'A report image is required' });
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (patientError) {
      console.error('Report patient lookup error:', patientError.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${id}/${Date.now()}-${safeFilename}`;

    const { error: uploadError } = await supabase.storage
      .from(REPORT_BUCKET)
      .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) {
      console.error('Report storage upload error:', uploadError.message);
      return res.status(500).json({ error: 'Could not upload the file. Please try again.' });
    }

    let aiSummary;
    try {
      const result = await reportSummaryModel.generateContent([
        { text: buildReportSummaryPrompt() },
        { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } },
      ]);
      aiSummary = result.response.text().trim();
    } catch (err) {
      console.error('Gemini report summary error:', err.message);
      return res.status(502).json({ error: 'Could not analyze this image right now. Please try again.' });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('patient_reports')
      .insert({
        patient_id: id,
        uploaded_by: req.worker.id,
        storage_path: storagePath,
        ai_summary: aiSummary,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Report insert error:', insertError.message);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }

    const { data: signedUrlData, error: signError } = await supabase.storage
      .from(REPORT_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signError) {
      console.error('Signed URL error:', signError.message);
    }

    return res.status(201).json({ ...inserted, signed_url: signedUrlData?.signedUrl || null });
  }
);

router.get('/:id/reports', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('patient_reports')
    .select('*')
    .eq('patient_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Reports list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const reportsWithUrls = await Promise.all(
    data.map(async (report) => {
      const { data: signedUrlData, error: signError } = await supabase.storage
        .from(REPORT_BUCKET)
        .createSignedUrl(report.storage_path, SIGNED_URL_TTL_SECONDS);

      if (signError) {
        console.error('Signed URL error:', signError.message);
      }

      return { ...report, signed_url: signedUrlData?.signedUrl || null };
    })
  );

  return res.json(reportsWithUrls);
});

export default router;
