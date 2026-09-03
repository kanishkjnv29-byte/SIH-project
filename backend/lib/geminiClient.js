import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const triageModel = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash-lite',
  generationConfig: { responseMimeType: 'application/json' },
});

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
