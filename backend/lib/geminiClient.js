import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const triageModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
  generationConfig: { responseMimeType: 'application/json' },
});

export const reportSummaryModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
});

export const schemeCheckModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash',
});

export const PMJAY_VERIFICATION_NOTE =
  'To check if this family is actually eligible, visit pmjay.gov.in, use the Ayushman Bharat app, visit a Common Service Centre, ask at the hospital, or call 14555.';

export function buildSchemeCheckPrompt({ age, symptoms, urgency_level, triage_reason }) {
  return `You are a decision-support tool helping a rural health worker in India understand whether a patient's situation is the KIND of care that Ayushman Bharat PM-JAY typically covers. You are NOT determining eligibility — eligibility depends on the family's income and documents, which this system does not have access to.

Ground your answer in ONLY these real facts about PM-JAY. Do not invent any other facts:
- PM-JAY provides cashless hospital treatment cover up to ₹5 lakh per family per year, for secondary and tertiary care (surgery, ICU admission, procedures requiring hospitalization).
- PM-JAY does NOT cover routine outpatient (OPD-only) visits.
- Beneficiaries aged 70 and above get an additional ₹5 lakh cover, not shared with the rest of the family.
- PM-JAY targets economically vulnerable families; it is not available to income-tax payers or government employees who already have other government health cover.
- It is completely free to eligible beneficiaries — there is no premium.

Patient information:
- Age: ${age ?? 'unknown'}
- Reported symptoms: ${symptoms ?? 'unknown'}
- Triage urgency: ${urgency_level ?? 'not yet triaged'}
- Triage reasoning: ${triage_reason ?? 'none given'}

In 2-3 short, plain-language sentences, explain whether this patient's situation sounds like the KIND of care PM-JAY typically covers (hospital admission, surgery, ICU, procedures) or sounds more like routine outpatient care that PM-JAY typically does not cover. Do NOT say the family "is eligible" or "is not eligible" — you do not have their income or documents. Only describe the KIND of care this looks like, in plain language a family could understand.

Respond with ONLY those 2-3 sentences. Do not include a heading, a disclaimer, or a closing statement — a closing statement will be added separately.`;
}

export async function runSchemeCheck({ age, symptoms, urgency_level, triage_reason }) {
  const prompt = buildSchemeCheckPrompt({ age, symptoms, urgency_level, triage_reason });
  const result = await schemeCheckModel.generateContent(prompt);
  const note = result.response.text().trim();

  if (!note) {
    throw new Error('Gemini returned an empty scheme-check response');
  }

  return `${note} ${PMJAY_VERIFICATION_NOTE}`;
}

export function buildReportSummaryPrompt() {
  return `You are a decision-support tool assisting a trained ASHA or Primary Health Centre (PHC) health worker in rural India. You are NOT providing a diagnosis — you are only helping them quickly understand a document a patient has brought in.

Look at the attached image, which should be a medical report or prescription. Give a short, plain-language summary of what it contains — key findings, medicines listed, or notable values — in 3-4 sentences maximum.

If the image is unclear, blurry, or does not appear to be a medical document at all, say so plainly instead of guessing at its contents.`;
}

const VALID_URGENCY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

export function buildTriagePrompt({ age, gender, symptoms }) {
  return `You are a decision-support tool assisting a trained ASHA or Primary Health Centre (PHC) health worker in rural India. You are NOT a diagnostic tool, and your output does not replace the health worker's own clinical judgment — it only helps them prioritize which patients need attention soonest.

Patient information:
- Age: ${age ?? 'unknown'}
- Gender: ${gender ?? 'unknown'}
- Reported symptoms: ${symptoms}

Assess the urgency of this case. Respond with ONLY a JSON object with exactly these two fields:
{"urgency_level": one of "LOW", "MEDIUM", "HIGH", "EMERGENCY", "reason": a 1-2 sentence plain-language explanation a busy health worker can read in a few seconds}

If the symptoms are ambiguous, incomplete, or could indicate something serious, lean toward the HIGHER urgency level rather than the lower one — always err on the side of caution.`;
}

export function parseTriageResponse(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (
    !parsed ||
    !VALID_URGENCY_LEVELS.includes(parsed.urgency_level) ||
    typeof parsed.reason !== 'string' ||
    !parsed.reason.trim()
  ) {
    return null;
  }

  return { urgency_level: parsed.urgency_level, reason: parsed.reason.trim() };
}
