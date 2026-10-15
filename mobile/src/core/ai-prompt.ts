// The prompt for making a plan with a chatbot (ChatGPT, Claude, Gemini…); its reply is read by plan-import.
import { ACTIVITY_LEVELS } from './profile';
import type { ActivityLevel } from './types';

export const AI_GOALS = { recomp: 'Lose fat and build muscle', gain: 'Build muscle', lose: 'Lose fat', strength: 'Get stronger' };

export type AiGoal = keyof typeof AI_GOALS;

/** What the AI sheet asks; empty strings are left out of the prompt */
export interface AiPromptInput {
  sex: string;
  age: string;
  height: string;
  weight: string;
  goal: string;
  days: string | number;
  level: string;
  equipment: string;
  notes: string;
  /** From the profile */
  goalKg?: number | null;
  activity?: ActivityLevel;
}

export function buildAiPrompt(input: AiPromptInput): string {
  const { sex, age, height, weight, days, level, notes } = input;
  const equipment = input.equipment.trim() || 'Standard commercial gym';
  const about = [
    sex && `Sex: ${sex}`,
    age && `Age: ${age}`,
    height && `Height: ${height} cm`,
    weight && `Weight: ${weight} kg`,
    input.goalKg && `Goal weight: ${input.goalKg} kg`,
    `Goal: ${AI_GOALS[input.goal as AiGoal] || AI_GOALS.recomp}`,
    input.activity && `Daily activity: ${ACTIVITY_LEVELS[input.activity].label}`,
    `Experience: ${level}`,
    `Equipment: ${equipment}`,
    notes && `Notes: ${notes}`
  ].filter(Boolean).map(line => `- ${line}`).join('\n');

  return `Act as an experienced strength coach. Create a ${days}-day-per-week workout plan for me, to be imported into my workout tracker app.

About me:
${about}

Rules:
- Exactly ${days} training days, 4–7 exercises per day, ordered big compound lifts first.
- "sets": 2–5. "reps": a range like "8–12 reps" (or "45s hold" / "Failure" where it fits).
- "weight": a realistic starting load for me, e.g. "40–50 kg", "12.5 kg DBs", "Moderate" or "Bodyweight".
- "rest": seconds between sets as a number (60–180).
- "cue": one short technique tip.
- "warmup": number of light ramp-up sets before the working sets (0–3), not counted as working sets. Use 2 for the day's first heavy compound lift (3 if its working sets are 5 reps or fewer), 1 for a later compound lift or the first exercise for a new joint or muscle (e.g. first biceps or triceps move, overhead or elbow-heavy moves), and 0 for isolation, high-rep or bodyweight work on muscles already warmed up.
- Every exercise needs an "alt": an alternative using different equipment, with its own sets/reps/weight/rest/cue tuned for the same effort (lighter load = more reps or slower tempo).

How to send it: create a downloadable JSON file named my-plan.json containing the plan, so I can download it and upload it to the app (a my-plan.txt file with the same JSON is fine too). Don't paste the JSON into the chat. Only if you can't create files at all, reply with just the JSON inside one code block and nothing else.

The file must be valid JSON in exactly this format:
{
  "planName": "Short plan name",
  "days": [
{
  "title": "Push – Chest, Shoulders & Triceps",
  "exercises": [
    {
      "name": "Barbell Bench Press",
      "warmup": 2,
      "sets": 3,
      "reps": "8–10 reps",
      "weight": "40–50 kg",
      "rest": 150,
      "cue": "3s lowering, pause on the chest",
      "alt": { "name": "DB Bench Press", "warmup": 2, "sets": 3, "reps": "10–12 reps", "weight": "15–20 kg DBs", "rest": 120, "cue": "Full stretch at the bottom" }
    }
  ]
}
  ]
}`;
}
