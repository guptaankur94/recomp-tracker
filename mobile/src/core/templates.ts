// Ready-made plans and how they are built from the library. Data: data/templates.json and the creator's
// own plan in data/default-plan.json (both exported from the web app).
import defaultPlan from './data/default-plan.json';
import templateData from './data/templates.json';
import { EQUIPMENT_ALLOWED, libExercise, type EquipmentKind, type ExerciseOverrides } from './library';
import { defaultSchedule } from './schedule';
import type { Plan, PlanDay } from './types';

export interface Template {
  id: string;
  name: string;
  /** Training days per week */
  days: number;
  level: string;
  equipment: EquipmentKind;
  minutes: number;
  blurb: string;
  type?: TemplateType;
  /** The plan this app was built around */
  creator?: boolean;
  /** Each day's title and exercises (with overrides); null for the creator's plan */
  plan: { title: string; exercises: ({ name: string } & ExerciseOverrides)[] }[] | null;
}

export type TemplateType = 'full' | 'split' | 'home' | 'strength';

export const TEMPLATES = templateData as Template[];

/** The creator's original plan, with their own weights */
export const DEFAULT_PLAN = defaultPlan as PlanDay[];

/** Grouping for the plan pickers */
export const TEMPLATE_TYPES: [TemplateType | 'all', string][] = [['all', 'All'], ['full', 'Full body'], ['split', 'Splits'], ['home', 'Home'], ['strength', 'Strength']];

export function templateById(id: string | null | undefined): Template {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}

export function templateType(t: Template): TemplateType {
  return t.type || (t.equipment !== 'gym' ? 'home' : /^full-body/.test(t.id) ? 'full' : 'split');
}

/** Switching to a type keeps the picked plan if it fits, otherwise picks that type's best match */
export function pickForFilter(currentId: string, type: TemplateType | 'all', recId: string | null): string {
  if (type === 'all' || templateType(templateById(currentId)) === type) return currentId;
  const group = TEMPLATES.filter(t => templateType(t) === type);
  return (group.find(t => t.id === recId) || group[0] || templateById(currentId)).id;
}

/** The creator's plan for someone else: effort targets instead of the creator's own weights
    (the app suggests weights after the first session). */
export function effortTarget(target: string | undefined): string {
  const t = String(target || '');
  if (!/\d\s*kg/i.test(t)) return t;
  return /^BW\b/i.test(t) ? 'Bodyweight + extra weight' : '2 reps in reserve';
}

export function creatorPlanDays(): PlanDay[] {
  const days: PlanDay[] = JSON.parse(JSON.stringify(DEFAULT_PLAN));
  days.forEach(d => d.exercises.forEach(ex => {
    ex.weightTarget = effortTarget(ex.weightTarget);
    if (ex.alt) ex.alt.weightTarget = effortTarget(ex.alt.weightTarget);
  }));
  return days;
}

/** A template as a plan in the app's stored format */
export function templatePlan(t: Template): Plan {
  const days: PlanDay[] = t.plan
    ? t.plan.map(({ title, exercises }, i) => ({
      day: `Day ${i + 1}`, title,
      exercises: exercises.map(({ name, ...o }) => libExercise(name, o, EQUIPMENT_ALLOWED[t.equipment]))
    }))
    : creatorPlanDays();
  return { planName: t.name.replace(/ \d×$/, ''), templateId: t.id, days, schedule: defaultSchedule(days.length) };
}

export interface SetupAnswers {
  days: number;
  equipment: EquipmentKind;
  level: string;
}

/** The recommended template for the setup answers */
export function recommendTemplate({ days, equipment, level }: SetupAnswers): string {
  if (equipment === 'bodyweight') return 'bodyweight-3';
  if (equipment === 'dumbbells') return 'dumbbell-3';
  if (days <= 2) return 'full-body-2';
  if (days <= 3) return 'full-body-3';
  if (days === 4) return 'upper-lower-4';
  if (days === 5) return level === 'Beginner' ? 'upper-lower-4' : 'recomp-5';
  return level === 'Beginner' ? 'upper-lower-4' : 'ppl-6';
}
