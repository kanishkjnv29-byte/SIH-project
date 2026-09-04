// One-off continuation of seed-demo-data.js's Steps 7-8, targeting exactly
// the patients that were skipped when the previous run's Gemini quota ran
// out. Does NOT wipe or recreate anything — it only adds the missing scheme
// checks and prescription reports to the dataset already in the DB.
//
// Usage: node seed-continue.js   (run from the backend/ folder, server running)

import 'dotenv/config';
import { Jimp, loadFont } from 'jimp';
import { SANS_16_BLACK, SANS_32_BLACK } from 'jimp/fonts';

const API_BASE = `http://localhost:${process.env.PORT || 5000}/api`;

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
      `  Gemini call failed (502) for ${label} — treating this as quota/rate limit exhausted.\n` +
        `  Skipping all remaining Gemini-dependent calls for the rest of this run.`
    );
    return null;
  }
  return res;
}

async function loginWorker(label, aadhaar, password) {
  const loginRes = await apiFetch('/auth/login', { method: 'POST', body: { aadhaar_number: aadhaar, password } });
  if (!loginRes.ok) throw new Error(`${label} login failed: ${JSON.stringify(loginRes.data)}`);
  const otpRes = await apiFetch('/auth/verify-otp', {
    method: 'POST',
    body: { aadhaar_number: aadhaar, otp: loginRes.data.demo_otp },
  });
  if (!otpRes.ok) throw new Error(`${label} OTP verification failed: ${JSON.stringify(otpRes.data)}`);
  console.log(`  ${label} logged in as "${otpRes.data.name}"`);
  return { token: otpRes.data.token, name: otpRes.data.name };
}

// Exactly the 5 patients still missing a scheme check, highest urgency first
// (3 EMERGENCY already done: Ramdhari Singh Dinkar, Mohammed Aslam, Anjali Gupta).
const SCHEME_CHECK_TARGETS = ['Chotu', 'Rajesh Kumar', 'Iqbal Ahmed', 'Kajal Yadav', 'Premchand'];

// Exactly the 3 patients whose Completed referrals never got a prescription
// report uploaded, with the facility they were referred to (for the image text)
// and which worker to upload as (matches the original run's assignment).
const REPORT_TARGETS = [
  { name: 'Ramdhari Singh Dinkar', facilityName: 'District Hospital, Gorakhpur', workerIndex: 0 },
  { name: 'Kajal Yadav', facilityName: 'CHC Pipraich', workerIndex: 1 },
  { name: 'Mohammed Aslam', facilityName: 'District Hospital, Gorakhpur', workerIndex: 0 },
];

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

async function main() {
  console.log('Gram Swasthya — continuing demo seeding (Steps 7-8 backfill only)');

  const worker1 = await loginWorker('Worker 1', process.env.DEMO_WORKER_1_AADHAAR, process.env.DEMO_WORKER_1_PASSWORD);
  const worker2 = await loginWorker('Worker 2', process.env.DEMO_WORKER_2_AADHAAR, process.env.DEMO_WORKER_2_PASSWORD);
  const workers = [worker1, worker2];

  const patientsRes = await apiFetch('/patients', { token: worker1.token });
  if (!patientsRes.ok) throw new Error(`Could not load patients: ${JSON.stringify(patientsRes.data)}`);
  const byName = Object.fromEntries(patientsRes.data.map((p) => [p.name, p]));

  console.log('\n=== Backfilling PMJAY scheme checks ===');
  let schemeSucceeded = 0;
  for (const name of SCHEME_CHECK_TARGETS) {
    const patient = byName[name];
    if (!patient) {
      console.error(`  SKIP: ${name} not found in DB`);
      continue;
    }
    if (patient.scheme_suggestion) {
      console.log(`  Already has a scheme suggestion, skipping: ${name}`);
      continue;
    }

    const res = await tryGeminiCall(name, () => apiFetch(`/patients/${patient.id}/scheme-check`, { method: 'POST', token: worker1.token }));
    if (!res) continue;
    if (!res.ok) {
      console.error(`  FAILED: ${name} — ${res.status} ${JSON.stringify(res.data)}`);
      continue;
    }
    console.log(`  ${name} — scheme suggestion generated`);
    schemeSucceeded += 1;
  }

  console.log('\n=== Backfilling prescription report uploads ===');
  let reportsSucceeded = 0;
  for (const target of REPORT_TARGETS) {
    const patient = byName[target.name];
    if (!patient) {
      console.error(`  SKIP: ${target.name} not found in DB`);
      continue;
    }

    const existingReports = await apiFetch(`/patients/${patient.id}/reports`, { token: worker1.token });
    if (existingReports.ok && existingReports.data.length > 0) {
      console.log(`  Already has a report, skipping: ${target.name}`);
      continue;
    }

    if (geminiBudgetExhausted) {
      console.log(`  Skipped (Gemini quota already exhausted this run): ${target.name}`);
      continue;
    }

    const worker = workers[target.workerIndex];
    const buffer = await buildPrescriptionImage({
      doctorName: FAKE_DOCTORS[reportsSucceeded % FAKE_DOCTORS.length],
      facilityName: target.facilityName,
      medicines: MEDICINE_SETS[reportsSucceeded % MEDICINE_SETS.length],
    });

    const form = new FormData();
    form.append('report', new Blob([buffer], { type: 'image/png' }), `prescription-${target.name.replace(/\s+/g, '_')}.png`);

    const res = await tryGeminiCall(target.name, () =>
      apiFetch(`/patients/${patient.id}/reports`, { method: 'POST', token: worker.token, form })
    );
    if (!res) continue;
    if (!res.ok) {
      console.error(`  FAILED: ${target.name} — ${res.status} ${JSON.stringify(res.data)}`);
      continue;
    }
    console.log(`  Uploaded prescription for ${target.name} — AI summary: "${res.data.ai_summary?.slice(0, 80)}..."`);
    reportsSucceeded += 1;
  }

  console.log('\n=== SUMMARY (this run) ===');
  console.log(`  New scheme checks:  ${schemeSucceeded} / ${SCHEME_CHECK_TARGETS.length} attempted`);
  console.log(`  New reports:        ${reportsSucceeded} / ${REPORT_TARGETS.length} attempted`);
  if (geminiBudgetExhausted) {
    console.log('\n  Gemini quota ran out again partway through — re-run this script once more quota is available.');
  } else {
    console.log('\n  All targeted backfill items completed — the demo dataset should now be fully seeded.');
  }
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
