// First launch: welcome → about you → your training → create your plan (ready-made, build your own, or AI)
// → a finish screen. Everyone leaves with a working plan; building your own or AI starts from the recommended
// plan, so backing out of either still leaves the app ready to train. Coming from the web app? The welcome
// screen restores a backup instead.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { restoreMessage } from '@/core/backup';
import { planSchedule, upNextDayIdx, WEEKDAYS } from '@/core/schedule';
import { pickForFilter, recommendTemplate, templateById, templatePlan, templateType, TEMPLATES, TEMPLATE_TYPES, type TemplateType } from '@/core/templates';
import { pickTextFile } from '@/data/files';
import type { SetupAnswers } from '@/data/repo';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { Choices, Field } from '@/ui/fields';
import { haptic } from '@/ui/haptics';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono, Title } from '@/ui/text';
import { useToast } from '@/ui/toast';

const GOALS = [
  { value: 'recomp', label: 'Lose fat & build muscle', sub: 'Both at once' },
  { value: 'gain', label: 'Build muscle', sub: 'Get bigger' },
  { value: 'lose', label: 'Lose fat', sub: 'Keep muscle while leaning out' },
  { value: 'strength', label: 'Get stronger', sub: 'Lift heavier' }
];
const LEVELS = [
  { value: 'Beginner', label: 'Beginner', sub: 'Under 1 year' },
  { value: 'Intermediate', label: 'Intermediate', sub: '1–3 years' },
  { value: 'Advanced', label: 'Advanced', sub: '3+ years' }
];
const EQUIPMENT = [
  { value: 'gym' as const, label: 'Full gym', sub: 'Barbells, machines, cables' },
  { value: 'dumbbells' as const, label: 'Dumbbells', sub: 'A pair of dumbbells and a bench' },
  { value: 'bodyweight' as const, label: 'No equipment', sub: 'Bodyweight at home' }
];

type Finish = 'set' | 'saved' | 'uploaded' | 'fallback';

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? null : Math.round(n * 10) / 10; };

export default function SetupScreen() {
  const params = useLocalSearchParams<{ finish?: Finish }>();
  const { profile, settings, updateProfile, updateSettings, choosePlan, restore } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  const saved = settings.setup || {};
  const [step, setStep] = useState<number>(params.finish ? 5 : 0);
  const [finish, setFinish] = useState<Finish>(params.finish || 'set');
  const [name, setName] = useState(profile?.name || '');
  const [sex, setSex] = useState<string>(profile?.sex || '');
  const [age, setAge] = useState(String(profile?.age ?? saved.age ?? ''));
  const [height, setHeight] = useState(String(profile?.heightCm ?? ''));
  const [weight, setWeight] = useState(String(profile?.weightKg ?? ''));
  const [goalKg, setGoalKg] = useState(String(profile?.goalKg ?? ''));
  const [goal, setGoal] = useState(saved.goal || profile?.goalType || 'recomp');
  const [level, setLevel] = useState(saved.level || 'Beginner');
  const [days, setDays] = useState(saved.days || 3);
  const [equipment, setEquipment] = useState<NonNullable<SetupAnswers['equipment']>>(saved.equipment || 'gym');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<TemplateType | 'all'>('all');
  const rec = recommendTemplate({ days, equipment, level });
  const [picked, setPicked] = useState<string | null>(null);
  const pickedId = picked || rec;

  const go = (n: number) => { setStep(n); setError(''); haptic('light'); };

  const saveAnswers = async () => {
    const patch: Record<string, unknown> = { sex, heightCm: num(height), weightKg: num(weight), goalKg: num(goalKg), goalType: goal === 'strength' ? 'gain' : goal };
    if (name.trim()) patch.name = name.trim();
    if (num(age) && !profile?.birthDate) patch.age = Math.round(num(age)!);
    await updateProfile(patch);
    await updateSettings({ setup: { age: num(age), goal, level, days, equipment } });
  };

  const aboutDone = async () => {
    if (!sex) return setError('Pick one so your targets are right.');
    const checks: [string, number, number, string][] = [[age, 13, 90, 'Age should be 13–90.'], [height, 100, 250, 'Height should be 100–250 cm.'], [weight, 25, 300, 'Weight should be 25–300 kg.']];
    for (const [v, lo, hi, msg] of checks) if (!(Number(num(v)) >= lo && Number(num(v)) <= hi)) return setError(msg);
    if (goalKg.trim() && !(Number(num(goalKg)) >= 25 && Number(num(goalKg)) <= 300)) return setError('Target weight should be 25–300 kg.');
    await saveAnswers();
    go(2);
  };

  // Every route leaves setup with a plan
  const start = async (path: 'sample' | 'own' | 'ai' | 'skip') => {
    haptic('light');
    if (path === 'sample') { setPicked(rec); return go(4); }
    const fallback = templateById(path === 'skip' ? 'full-body-3' : rec);
    await choosePlan(templatePlan(fallback));
    await updateSettings({ onboarded: true });
    if (path === 'skip') {
      toast(`Starting you on ${fallback.name}. Change it any time in Plan.`, { durationMs: 4000 });
      router.replace('/');
    } else if (path === 'own') {
      router.replace({ pathname: '/plan-editor', params: { build: String(days), setup: '1' } });
    } else {
      router.replace({ pathname: '/ai-plan', params: { setup: '1' } });
    }
  };

  const useTemplate = async () => {
    await choosePlan(templatePlan(templateById(pickedId)));
    await updateSettings({ onboarded: true });
    setFinish('set');
    go(5);
    haptic('success');
  };

  const restoreBackup = async () => {
    try {
      const text = await pickTextFile();
      if (text === null) return;
      const result = await restore(text);
      await updateSettings({ onboarded: true });
      haptic('success');
      toast(restoreMessage(result), { durationMs: 6000 });
      router.replace('/');
    } catch (e) {
      haptic('error');
      toast(e instanceof Error ? e.message : "Couldn't read that file.", { error: true, durationMs: 6000 });
    }
  };

  const stages = ['About you', 'Training', 'Your plan'];
  const stage = step >= 5 ? 4 : Math.min(step, 3);
  const progress = step > 0 && step < 5 && (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel={`Step ${Math.min(stage, 3)} of 3: ${stages[Math.min(stage, 3) - 1]}`}>
      {stages.map((label, i) => {
        const n = i + 1;
        const done = stage > n;
        const on = stage === n;
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.accent : on ? c.ink : 'transparent', borderWidth: done || on ? 0 : 1, borderColor: c.line }}>
              <Mono bold style={{ fontSize: 11 }} color={done || on ? c.onAccent : c.muted}>{done ? '✓' : n}</Mono>
            </View>
            <Mono style={{ fontSize: 11 }} color={on ? c.ink : c.muted} numberOfLines={1}>{label}</Mono>
          </View>
        );
      })}
    </View>
  );
  const back = step > 0 && step < 5 && (
    <Pressable onPress={() => go(step - 1)} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
      <Body color={c.accent}>‹ Back</Body>
    </Pressable>
  );
  const errorLine = error ? <Body style={{ fontSize: 14 }} color={c.danger} accessibilityLiveRegion="polite">{error}</Body> : null;

  if (step === 0) {
    const point = (title: string, text: string) => (
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 9, backgroundColor: c.accent }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Body bold>{title}</Body>
          <Body color={c.inkSoft} style={{ fontSize: 14 }}>{text}</Body>
        </View>
      </View>
    );
    return (
      <Screen tabBar={false}>
        <Animated.View entering={FadeIn.duration(400)} style={{ gap: 18, paddingTop: 12 }}>
          <Image source={require('@/assets/images/icon.png')} accessibilityIgnoresInvertColors style={{ width: 88, height: 88, borderRadius: 22, alignSelf: 'center' }} />
          <Title style={{ textAlign: 'center' }}>Welcome to Recomp</Title>
          <Body color={c.inkSoft} style={{ textAlign: 'center' }}>Your training plan, rest timer and progress in one place.</Body>
          {point('A plan that fits you', 'Start from a ready-made plan, build your own, or let AI create one. Change anything, any time.')}
          {point('Log in seconds', 'Tap ✓ after each set and the rest timer starts on its own.')}
          {point('See yourself improve', 'Records for more weight, more reps, or the same work on less rest.')}
          {point('Private by design', 'Everything stays on this phone. No account needed.')}
          <Button label="Get started" kind="primary" onPress={() => go(1)} style={{ marginTop: 8 }} />
          <Button label="I have a backup from the web app" onPress={restoreBackup} />
          <Pressable onPress={() => start('skip')} accessibilityRole="button" style={{ alignSelf: 'center', padding: 10, marginBottom: insets.bottom }}>
            <Body color={c.inkSoft}>Skip for now</Body>
          </Pressable>
        </Animated.View>
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen tabBar={false}>
        {back}{progress}
        <Title>About you</Title>
        <Body color={c.inkSoft}>Used to shape your plan and your calorie and protein targets. It stays on this phone.</Body>
        <Field label="Your name" value={name} onChangeText={setName} placeholder="First name (optional)" autoComplete="given-name" textContentType="givenName" />
        <Choices label="Sex" value={sex} onChange={v => { setSex(v); setError(''); }} columns={2} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" inputMode="numeric" placeholder="e.g. 30" />
          <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="decimal-pad" inputMode="decimal" placeholder="cm" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" inputMode="decimal" placeholder="kg" />
          <Field label="Target weight" value={goalKg} onChangeText={setGoalKg} keyboardType="decimal-pad" inputMode="decimal" placeholder="kg · optional" />
        </View>
        {errorLine}
        <Button label="Continue" kind="primary" onPress={aboutDone} />
      </Screen>
    );
  }

  if (step === 2) {
    return (
      <Screen tabBar={false}>
        {back}{progress}
        <Title>Your training</Title>
        <Body color={c.inkSoft}>Be realistic. A plan you can keep up beats a perfect one.</Body>
        <Choices label="Main goal" value={goal} onChange={setGoal} columns={2} options={GOALS} />
        <Choices label="How long have you been lifting?" value={level} onChange={setLevel} columns={3} options={LEVELS} />
        <Choices label="Days per week" value={days} onChange={setDays} options={[2, 3, 4, 5, 6].map(n => ({ value: n, label: String(n) }))} />
        <Choices label="Where do you train?" value={equipment} onChange={setEquipment} columns={1} options={EQUIPMENT} />
        <Button label="Continue" kind="primary" onPress={async () => { await saveAnswers(); go(3); }} />
      </Screen>
    );
  }

  if (step === 3) {
    const recName = templateById(rec).name;
    const option = (title: string, sub: string, onPress: () => void) => (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
        style={({ pressed }) => ({ padding: 16, gap: 4, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surfaceHigh : c.surface })}>
        <Body bold style={{ fontSize: 16 }}>{title} ›</Body>
        <Body color={c.inkSoft} style={{ fontSize: 14 }}>{sub}</Body>
      </Pressable>
    );
    return (
      <Screen tabBar={false}>
        {back}{progress}
        <Title>Create your plan</Title>
        <Body color={c.inkSoft}>{name.trim() ? `${name.trim()}, w` : 'W'}hichever you pick, the plan is yours. Edit any day, exercise, set or rest time later in the Plan tab.</Body>
        {option('Pick a ready-made plan', `Full body, splits, home, strength and more, with warm-ups, rest times and swaps. We suggest ${recName} for you.`, () => start('sample'))}
        {option('Create your own plan', 'Pick your days and exercises from a library of 70+ moves. Sets, reps, rest and warm-ups are filled in for you.', () => start('own'))}
        {option('Create your plan with AI', 'Copy a prompt with your details into ChatGPT, Claude or Gemini, and upload the plan file it gives you.', () => start('ai'))}
      </Screen>
    );
  }

  if (step === 4) {
    const shown = TEMPLATES.filter(t => filter === 'all' || templateType(t) === filter);
    const chosen = templateById(pickedId);
    return (
      <Screen tabBar={false}>
        {back}{progress}
        <Title>Ready-made plans</Title>
        <Body color={c.inkSoft}>Every exercise has a swap if a machine is taken, plus warm-up sets and rest times. Nothing is locked.</Body>
        <Choices value={filter} onChange={f => { setFilter(f); setPicked(pickForFilter(pickedId, f, rec)); }} options={TEMPLATE_TYPES.map(([value, label]) => ({ value, label }))} />
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {shown.map(t => {
            const on = t.id === pickedId;
            return (
              <Pressable key={t.id} onPress={() => { setPicked(t.id); haptic('light'); }} accessibilityRole="radio" aria-checked={on}
                style={{ padding: 16, gap: 6, borderRadius: theme.radius, borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.surface }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <Title size={21} style={{ flex: 1 }}>{t.name}</Title>
                  {t.id === rec && <Mono style={{ fontSize: 11 }} color={c.accent}>FOR YOU</Mono>}
                </View>
                <Mono color={t.creator ? c.record : c.inkSoft}>{t.creator ? "Creator's plan · " : ''}{t.days} days · ~{t.minutes} min · {t.level}</Mono>
                <Body color={c.inkSoft} style={{ fontSize: 14 }}>{t.blurb}</Body>
                {on && <Body style={{ fontSize: 13 }} color={c.ink}>{templatePlan(t).days.map(d => d.title).join(' · ')}</Body>}
              </Pressable>
            );
          })}
        </View>
        <Button label={`Use ${chosen.name}`} kind="primary" onPress={useTemplate} />
      </Screen>
    );
  }

  return <FinishScreen result={finish} name={name || profile?.name || ''} />;
}

/** One calm screen with what to know, then the workout */
function FinishScreen({ result, name }: { result: Finish; name: string }) {
  const { activePlan, history } = useData();
  const { theme } = useTheme();
  const c = theme.colors;
  const schedule = planSchedule(activePlan, activePlan.days.length);
  const first = activePlan.days[upNextDayIdx(activePlan.days, schedule, history)];
  const title = result === 'uploaded' ? 'Plan uploaded' : result === 'fallback' ? 'Ready when you are' : "You're all set";
  const sub = result === 'uploaded' ? 'Your AI plan is in and ready to train.'
    : result === 'fallback' ? `We've started you on ${activePlan.planName} so you can train today. Build your own or create one with AI any time in the Plan tab.`
      : `${name.trim() ? `${name.trim()}, y` : 'Y'}our plan is ready.`;
  return (
    <Screen tabBar={false}>
      <Animated.View entering={ZoomIn.duration(400)} style={{ alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
        <Body bold style={{ fontSize: 34 }} color={c.onAccent}>✓</Body>
      </Animated.View>
      <Title style={{ textAlign: 'center' }}>{title}</Title>
      <Body color={c.inkSoft} style={{ textAlign: 'center' }}>{sub}</Body>
      <Card>
        <Body bold>{activePlan.planName}</Body>
        <Mono style={{ fontSize: 12 }}>{activePlan.days.length} day{activePlan.days.length === 1 ? '' : 's'} a week{schedule ? ` · ${WEEKDAYS.filter((_, w) => Number.isInteger(schedule[w])).join(', ')}` : ''} · first up: {first?.title}</Mono>
      </Card>
      <Card>
        <Body bold>This plan is yours</Body>
        <Body color={c.inkSoft} style={{ fontSize: 14 }}>Change any day, exercise, set or rest time in the Plan tab. Your history is always kept.</Body>
      </Card>
      <Card>
        <Body bold>How logging works</Body>
        <Body color={c.inkSoft} style={{ fontSize: 14 }}>1. Type the weight and reps you did. Grey numbers are suggestions.</Body>
        <Body color={c.inkSoft} style={{ fontSize: 14 }}>2. Tap ✓ to log the set. The rest timer starts on its own.</Body>
        <Body color={c.inkSoft} style={{ fontSize: 14 }}>3. Tap Finish workout at the bottom when you&apos;re done.</Body>
      </Card>
      <Button label="Start training" kind="primary" onPress={() => router.replace('/')} />
    </Screen>
  );
}
