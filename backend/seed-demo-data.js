// Demo data seeding script.
//
// Wipes existing clinical data and rebuilds a realistic demo dataset by making
// real calls against this project's own running API (real Gemini calls for
// triage / scheme-check / report summaries included). Takes a few minutes.
//
// Prerequisite: the backend server must already be running (`npm run dev`
// in backend/), since this script is itself an API client.
//
// Usage: node seed-demo-data.js   (run from the backend/ folder)

import 'dotenv/config';
import { Jimp, loadFont } from 'jimp';
import { SANS_16_BLACK, SANS_32_BLACK } from 'jimp/fonts';
import { supabase } from './lib/supabaseClient.js';

const API_BASE = `http://localhost:${process.env.PORT || 5000}/api`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logStep(n, title) {
  console.log(`\n=== STEP ${n} — ${title} ===`);
}

async function apiFetch(path, { method = 'GET', body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let fetchBody;
  if (form) {
    fetchBody = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: fetchBody });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }

  return { ok: res.ok, status: res.status, data };
}

// The free-tier Gemini key backing this project has a small PER-DAY request
// cap shared across triage/scheme-check/report-summary calls. Once we see a
// 502 from any Gemini-backed endpoint, further attempts are almost certainly
// futile — so we stop making new Gemini calls for the rest of this run
// instead of burning time (and any quota that does trickle back) on retries.
let geminiBudgetExhausted = false;

async function tryGeminiCall(label, fn) {
  if (geminiBudgetExhausted) {
    console.log(`  Skipped (Gemini quota already exhausted this run): ${label}`);
    return null;
  }

  const res = await fn();

  if (!res.ok && res.status === 502) {
    geminiBudgetExhausted = true;
    console.error(
      `  Gemini call failed (502) for ${label} — treating this as today's Gemini quota/rate limit being exhausted.\n` +
        `  Skipping all remaining Gemini-dependent calls (triage / scheme-check / report-summary) for the rest of this run.`
    );
    return null;
  }

  return res;
}

async function ensureServerRunning() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('unhealthy');
  } catch {
    console.error(
      `\nCould not reach the backend at ${API_BASE}.\n` +
        `Start it first — in the backend/ folder, run "npm run dev" — then re-run this script.\n`
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// STEP 1 — clear existing clinical data
// ---------------------------------------------------------------------------

async function clearTable(table) {
  const { data, error } = await supabase.from(table).delete().not('id', 'is', null).select('id');
  if (error) {
    throw new Error(`Failed to clear "${table}": ${error.message}`);
  }
  console.log(`  Deleted ${data.length} row(s) from ${table}`);
  return data.length;
}

async function clearClinicalData() {
  logStep(1, 'Clearing existing clinical data (patient_reports, follow_ups, referrals, patients)');
  await clearTable('patient_reports');
  await clearTable('follow_ups');
  await clearTable('referrals');
  await clearTable('patients');
}

// ---------------------------------------------------------------------------
// STEP 2 — log in both demo workers
// ---------------------------------------------------------------------------

async function loginWorker(label, aadhaar, password) {
  if (!aadhaar || !password) {
    throw new Error(
      `${label}: missing Aadhaar/password. Set DEMO_WORKER_1_AADHAAR/PASSWORD and ` +
        `DEMO_WORKER_2_AADHAAR/PASSWORD in backend/.env, then re-run this script.`
    );
  }

  const loginRes = await apiFetch('/auth/login', {
    method: 'POST',
    body: { aadhaar_number: aadhaar, password },
  });

  if (!loginRes.ok) {
    throw new Error(
      `${label}: login failed (${loginRes.status} ${JSON.stringify(loginRes.data)}). ` +
        `Check DEMO_WORKER_*_AADHAAR/PASSWORD in backend/.env match a real account.`
    );
  }

  const otp = loginRes.data.demo_otp;
  const verifyRes = await apiFetch('/auth/verify-otp', {
    method: 'POST',
    body: { aadhaar_number: aadhaar, otp },
  });

  if (!verifyRes.ok) {
    throw new Error(`${label}: OTP verification failed (${verifyRes.status} ${JSON.stringify(verifyRes.data)}).`);
  }

  console.log(`  ${label} logged in as "${verifyRes.data.name}" (${verifyRes.data.role})`);
  return { token: verifyRes.data.token, id: verifyRes.data.id, name: verifyRes.data.name };
}

async function loginDemoWorkers() {
  logStep(2, 'Logging in both demo workers');
  const worker1 = await loginWorker(
    'Worker 1',
    process.env.DEMO_WORKER_1_AADHAAR,
    process.env.DEMO_WORKER_1_PASSWORD
  );
  const worker2 = await loginWorker(
    'Worker 2',
    process.env.DEMO_WORKER_2_AADHAAR,
    process.env.DEMO_WORKER_2_PASSWORD
  );
  return [worker1, worker2];
}

// ---------------------------------------------------------------------------
// STEP 3 — create the 16 demo patients
// ---------------------------------------------------------------------------

const PATIENT_DEFS = [
  { name: 'Sunita Devi', age: 34, gender: 'Female', village: 'Karmha', phone: '9000000001', symptoms: 'Fever and headache for 2 days, mild body ache' },
  { name: 'Ramdhari Singh Dinkar', age: 66, gender: 'Male', village: 'Bhura', phone: '9000000002', symptoms: 'Chest pain radiating to left arm since this morning, sweating heavily' },
  { name: 'Kajal Yadav', age: 8, gender: 'Female', village: 'Rampur', phone: '9000000003', symptoms: 'High fever since last night, not eating anything' },
  { name: 'Mohammed Aslam', age: 52, gender: 'Male', village: 'Pipraich', phone: '9000000004', symptoms: 'Sudden weakness on right side of body, slurred speech since afternoon' },
  { name: 'Premchand', age: 45, gender: 'Male', village: 'Bhura', phone: '9000000005', symptoms: 'पेट में दर्द और उल्टी, तीन दिन से' },
  { name: 'Radha Devi', age: 70, gender: 'Female', village: 'Kahjani', phone: '9000000006', symptoms: 'Persistent cough with blood for 2 weeks, weight loss' },
  { name: 'Anjali Gupta', age: 27, gender: 'Female', village: 'Sardar Nagar', phone: '9000000007', symptoms: 'Fever and pain, 3 days after delivery' },
  { name: 'Chotu', age: 0, gender: 'Male', village: 'Karmha', phone: '9000000008', symptoms: 'Newborn baby not feeding well, low activity since birth' },
  { name: 'Fatima Khatoon', age: 60, gender: 'Female', village: 'Campierganj', phone: '9000000009', symptoms: 'Blurred vision and frequent urination, known diabetic' },
  { name: 'Rajesh Kumar', age: 55, gender: 'Male', village: 'Bhura', phone: '9000000010', symptoms: 'Sudden chest pain and breathlessness, farmer, woke up with symptoms' },
  { name: 'Meena Kumari', age: 19, gender: 'Female', village: 'Pipraich', phone: '9000000011', symptoms: 'Mild cold and cough for 2 days' },
  { name: 'Iqbal Ahmed', age: 40, gender: 'Male', village: 'Sardar Nagar', phone: '9000000012', symptoms: 'Deep cut on hand from farm equipment, bleeding heavily' },
  { name: 'Vikram Singh', age: 25, gender: 'Male', village: 'Rampur', phone: '9000000013', symptoms: 'Fever and joint pain since yesterday' },
  { name: 'Zainab Bano', age: 3, gender: 'Female', village: 'Campierganj', phone: '9000000014', symptoms: 'High fever with skin rash, child, 2 days' },
  { name: 'Harish Chandra', age: 82, gender: 'Male', village: 'Bhura', phone: '9000000015', symptoms: 'Fell down at home, hip pain, cannot walk or stand' },
  { name: 'Suryakant Nirala', age: 78, gender: 'Male', village: 'Kahjani', phone: '9000000016', symptoms: 'Shortness of breath, swelling in both legs for a week' },
];

async function createPatients(workers) {
  logStep(3, 'Creating 16 demo patients');
  const created = [];

  for (let i = 0; i < PATIENT_DEFS.length; i++) {
    const def = PATIENT_DEFS[i];
    const worker = workers[i % 2];

    const res = await apiFetch('/patients', {
      method: 'POST',
      token: worker.token,
      body: {
        name: def.name,
        age: def.age,
        gender: def.gender,
        village: def.village,
        phone: def.phone,
        symptoms: def.symptoms,
      },
    });

    if (!res.ok) {
      console.error(`  FAILED: ${def.name} (via ${worker.name}) — ${res.status} ${JSON.stringify(res.data)}`);
      continue;
    }

    console.log(`  Created ${def.name} (${def.village}) — via ${worker.name}`);
    created.push({ ...def, id: res.data.id, worker });
  }

  return created;
}

// ---------------------------------------------------------------------------
// STEP 4 — run AI triage on all patients
// ---------------------------------------------------------------------------

async function triagePatients(patients) {
  logStep(4, 'Running AI triage on all patients');

  for (const patient of patients) {
    if (geminiBudgetExhausted) {
      console.log(`  Skipped (Gemini quota already exhausted this run): ${patient.name}`);
      continue;
    }

    const res = await tryGeminiCall(patient.name, () =>
      apiFetch(`/patients/${patient.id}/triage`, { method: 'POST', token: patient.worker.token })
    );

    if (!res) continue;

    if (!res.ok) {
      console.error(`  FAILED: ${patient.name} — ${res.status} ${JSON.stringify(res.data)}`);
      continue;
    }

    patient.urgency_level = res.data.urgency_level;
    patient.triage_reason = res.data.triage_reason;
    console.log(`  ${patient.name}: ${patient.urgency_level}`);

    await sleep(300);
  }
}

// ---------------------------------------------------------------------------
// STEP 5 — the deliberate Rajesh Kumar cascade-demo chain
// ---------------------------------------------------------------------------

async function buildRajeshChain(patients, workers, facilitiesByName) {
  logStep(5, "Building Rajesh Kumar's 3-step referral chain (left PENDING for a live demo)");

  const rajesh = patients.find((p) => p.name === 'Rajesh Kumar');
  if (!rajesh) {
    console.error('  FAILED: Rajesh Kumar was not created — skipping chain setup.');
    return;
  }

  const chc = facilitiesByName['CHC Pipraich'];
  const districtHospital = facilitiesByName['District Hospital, Gorakhpur'];

  const ref1 = await apiFetch('/referrals', {
    method: 'POST',
    token: workers[0].token,
    body: {
      patient_id: rajesh.id,
      facility_id: chc.id,
      reason: 'Suspected cardiac event, needs urgent evaluation',
    },
  });

  if (!ref1.ok) {
    console.error(`  FAILED (step a, Worker 1 → CHC Pipraich): ${ref1.status} ${JSON.stringify(ref1.data)}`);
    return;
  }
  console.log('  a. Worker 1 referred Rajesh Kumar → CHC Pipraich (PENDING)');

  const ref2 = await apiFetch('/referrals', {
    method: 'POST',
    token: workers[1].token,
    body: {
      patient_id: rajesh.id,
      facility_id: districtHospital.id,
      reason: 'CHC stabilized, needs cardiac catheterization/ICU',
    },
  });

  if (!ref2.ok) {
    console.error(`  FAILED (step b, Worker 2 → District Hospital): ${ref2.status} ${JSON.stringify(ref2.data)}`);
    return;
  }
  console.log('  b. Worker 2 referred Rajesh Kumar → District Hospital, Gorakhpur (PENDING)');
  console.log(
    `     Auto-linked to prior referral: previous_referral_id = ${ref2.data.previous_referral_id === ref1.data.id ? 'confirmed ✓' : 'MISMATCH — check manually'}`
  );

  console.log(
    '\n  >>> Rajesh Kumar\'s chain is ready and left PENDING on purpose. <<<\n' +
      '  >>> Mark the District Hospital referral COMPLETED live, in front of judges, to trigger the cascade back to Worker 1. Do NOT complete it now. <<<'
  );
}

// ---------------------------------------------------------------------------
// STEP 6 — referrals for 8 more patients, routed by urgency, mixed status
// ---------------------------------------------------------------------------

const VILLAGE_LOW_TIER_FACILITY = {
  Karmha: 'Sub-Centre Karmha',
  'Sardar Nagar': 'PHC Sardar Nagar',
  Campierganj: 'PHC Campierganj',
  Kahjani: 'Sub-Centre Bhaisanathu',
  Bhura: 'PHC Sardar Nagar',
  Rampur: 'PHC Campierganj',
  Pipraich: 'Sub-Centre Bhaisanathu',
};

function pickFacilityForReferral(patient, facilitiesByName) {
  if (patient.urgency_level === 'EMERGENCY') {
    return facilitiesByName['District Hospital, Gorakhpur'];
  }
  if (patient.urgency_level === 'HIGH') {
    return facilitiesByName['CHC Pipraich'];
  }
  const name = VILLAGE_LOW_TIER_FACILITY[patient.village] || 'PHC Sardar Nagar';
  return facilitiesByName[name];
}

function selectEightForReferral(patients) {
  const candidates = patients.filter((p) => p.name !== 'Rajesh Kumar' && p.urgency_level);
  const highTier = candidates.filter((p) => ['EMERGENCY', 'HIGH'].includes(p.urgency_level));
  const lowTier = candidates.filter((p) => ['LOW', 'MEDIUM'].includes(p.urgency_level));

  let selected = [...highTier.slice(0, 5), ...lowTier.slice(0, 3)];
  if (selected.length < 8) {
    const remaining = candidates.filter((p) => !selected.includes(p));
    selected = selected.concat(remaining.slice(0, 8 - selected.length));
  }
  return selected.slice(0, 8);
}

async function createRemainingReferrals(patients, workers, facilitiesByName) {
  logStep(6, 'Creating referrals for 8 more patients, routed by urgency, mixed Pending/Completed');

  const selected = selectEightForReferral(patients);
  const results = [];

  for (let i = 0; i < selected.length; i++) {
    const patient = selected[i];
    const worker = workers[i % 2];
    const facility = pickFacilityForReferral(patient, facilitiesByName);

    if (!facility) {
      console.error(`  FAILED: no facility resolved for ${patient.name} (urgency ${patient.urgency_level})`);
      continue;
    }

    const res = await apiFetch('/referrals', {
      method: 'POST',
      token: worker.token,
      body: {
        patient_id: patient.id,
        facility_id: facility.id,
        reason: `Referred based on triage: ${patient.triage_reason}`.slice(0, 950),
      },
    });

    if (!res.ok) {
      console.error(`  FAILED: ${patient.name} → ${facility.name} — ${res.status} ${JSON.stringify(res.data)}`);
      continue;
    }

    console.log(`  ${patient.name} (${patient.urgency_level}) → ${facility.name} — via ${worker.name}`);
    results.push({ patient, referralId: res.data.id, facility, worker });
  }

  // Mark the first 4 Completed, leave the rest Pending.
  for (let i = 0; i < results.length; i++) {
    const { patient, referralId, worker } = results[i];
    if (i < 4) {
      const statusRes = await apiFetch(`/referrals/${referralId}/status`, {
        method: 'PATCH',
        token: worker.token,
        body: { status: 'COMPLETED' },
      });
      if (statusRes.ok) {
        console.log(`  Marked COMPLETED: ${patient.name}`);
      } else {
        console.error(`  FAILED to mark COMPLETED: ${patient.name} — ${statusRes.status} ${JSON.stringify(statusRes.data)}`);
      }
    } else {
      console.log(`  Left PENDING: ${patient.name}`);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// STEP 7 — PMJAY scheme check for 8 triaged patients (highest urgency first)
// ---------------------------------------------------------------------------

const URGENCY_RANK = { EMERGENCY: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

async function runSchemeChecks(patients) {
  logStep(7, 'Running PMJAY scheme check for 8 patients (highest urgency first)');

  const triaged = patients.filter((p) => p.urgency_level);
  const prioritized = [...triaged].sort((a, b) => (URGENCY_RANK[b.urgency_level] ?? -1) - (URGENCY_RANK[a.urgency_level] ?? -1));
  const selected = prioritized.slice(0, 8);

  let succeeded = 0;
  for (const patient of selected) {
    if (geminiBudgetExhausted) {
      console.log(`  Skipped (Gemini quota already exhausted this run): ${patient.name}`);
      continue;
    }

    const res = await tryGeminiCall(patient.name, () =>
      apiFetch(`/patients/${patient.id}/scheme-check`, { method: 'POST', token: patient.worker.token })
    );

    if (!res) continue;

    if (!res.ok) {
      console.error(`  FAILED: ${patient.name} — ${res.status} ${JSON.stringify(res.data)}`);
      continue;
    }

    console.log(`  ${patient.name} (${patient.urgency_level}) — scheme suggestion generated`);
    succeeded += 1;
    await sleep(300);
  }

  return succeeded;
}

// ---------------------------------------------------------------------------
// STEP 8 — synthetic prescription images uploaded as reports
// ---------------------------------------------------------------------------

const MEDICINE_SETS = [
  ['Paracetamol 500mg', 'ORS Sachets', 'Vitamin C 500mg'],
  ['Amoxicillin 250mg', 'Cough Syrup 10ml', 'Paracetamol 500mg'],
  ['Metformin 500mg', 'Azithromycin 500mg', 'Multivitamin'],
];

const FAKE_DOCTORS = ['Dr. A. Verma, MBBS', 'Dr. S. Khan, MBBS, MD', 'Dr. R. Prasad, MBBS'];

async function buildPrescriptionImage({ doctorName, facilityName, medicines }) {
  const font32 = await loadFont(SANS_32_BLACK);
  const font16 = await loadFont(SANS_16_BLACK);

  const image = new Jimp({ width: 600, height: 400, color: 0xffffffff });

  image.print({ font: font32, x: 30, y: 24, text: 'PRESCRIPTION' });
  image.print({ font: font16, x: 30, y: 90, text: doctorName });
  image.print({ font: font16, x: 30, y: 118, text: facilityName });
  image.print({ font: font16, x: 30, y: 160, text: 'Rx:' });

  medicines.forEach((med, i) => {
    image.print({ font: font16, x: 50, y: 190 + i * 30, text: `- ${med}` });
  });

  return image.getBuffer('image/png');
}

async function uploadPrescriptionReports(referralResults) {
  logStep(8, 'Generating and uploading 3 synthetic prescription images');

  const targets = referralResults.slice(0, 3);
  let uploaded = 0;

  for (let i = 0; i < targets.length; i++) {
    if (geminiBudgetExhausted) {
      console.log(`  Skipped (Gemini quota already exhausted this run): ${targets[i].patient.name}`);
      continue;
    }

    const { patient, facility, worker } = targets[i];
    const buffer = await buildPrescriptionImage({
      doctorName: FAKE_DOCTORS[i % FAKE_DOCTORS.length],
      facilityName: facility.name,
      medicines: MEDICINE_SETS[i % MEDICINE_SETS.length],
    });

    const form = new FormData();
    form.append('report', new Blob([buffer], { type: 'image/png' }), `prescription-${patient.name.replace(/\s+/g, '_')}.png`);

    const res = await tryGeminiCall(patient.name, () =>
      apiFetch(`/patients/${patient.id}/reports`, { method: 'POST', token: worker.token, form })
    );

    if (!res) continue;

    if (!res.ok) {
      console.error(`  FAILED: ${patient.name} — ${res.status} ${JSON.stringify(res.data)}`);
      continue;
    }

    console.log(`  Uploaded prescription for ${patient.name} — AI summary: "${res.data.ai_summary?.slice(0, 80)}..."`);
    uploaded += 1;
  }

  return uploaded;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Gram Swasthya — demo data seeding script');
  console.log(`API base: ${API_BASE}`);

  await ensureServerRunning();
  await clearClinicalData();

  const workers = await loginDemoWorkers();

  const patients = await createPatients(workers);
  if (patients.length === 0) {
    throw new Error('No patients were created — aborting the rest of the seed.');
  }

  await triagePatients(patients);

  const facilitiesRes = await apiFetch('/facilities', { token: workers[0].token });
  if (!facilitiesRes.ok) {
    throw new Error(`Could not load facilities: ${facilitiesRes.status} ${JSON.stringify(facilitiesRes.data)}`);
  }
  const facilitiesByName = Object.fromEntries(facilitiesRes.data.map((f) => [f.name, f]));

  await buildRajeshChain(patients, workers, facilitiesByName);
  const referralResults = await createRemainingReferrals(patients, workers, facilitiesByName);
  const schemeCheckedCount = await runSchemeChecks(patients);
  const uploadedReportsCount = await uploadPrescriptionReports(referralResults);

  const triagedCount = patients.filter((p) => p.urgency_level).length;

  console.log('\n=== SUMMARY ===');
  console.log(`  Patients created:       ${patients.length}`);
  console.log(`  Patients triaged:       ${triagedCount}`);
  console.log(`  Referrals created:      ${referralResults.length + 2} (incl. Rajesh Kumar's 2-step chain)`);
  console.log(`  Scheme checks run:      ${schemeCheckedCount}`);
  console.log(`  Prescription reports:   ${uploadedReportsCount}`);
  if (geminiBudgetExhausted) {
    console.log(
      '\n  NOTE: Gemini\'s free-tier daily quota ran out partway through this run, so some patients were\n' +
        '  never triaged / scheme-checked, and some prescription reports were skipped. Re-run this script\n' +
        '  once the quota resets to fill in the rest — it re-seeds from a clean slate each time.'
    );
  }
  console.log(
    '\n  Reminder: Rajesh Kumar has a 2-step referral chain (CHC Pipraich → District Hospital, Gorakhpur),\n' +
      '  both left PENDING on purpose. Mark the District Hospital referral COMPLETED live in front of\n' +
      '  judges to trigger the cascade follow-up back to Worker 1 — do not complete it before the demo.'
  );
}

main().catch((err) => {
  console.error('\nSeeding failed:', err.message);
  process.exit(1);
});
