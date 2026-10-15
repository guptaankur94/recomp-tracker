// Create a plan with AI: your details go into a prompt for ChatGPT, Claude or Gemini, and the plan file it
// gives back is read in. The details are saved to your profile as you go.
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, TextInput, View } from 'react-native';

import { AI_GOALS, buildAiPrompt, type AiGoal } from '@/core/ai-prompt';
import { extractJson, normalizePlan } from '@/core/plan-import';
import { currentWeightKg, profileAge } from '@/core/profile';
import type { Plan } from '@/core/types';
import { pickTextFile } from '@/data/files';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { Choices, Field } from '@/ui/fields';
import { haptic } from '@/ui/haptics';
import { Header, SectionLabel } from '@/ui/parts';
import { PlanDays } from '@/ui/plan-days';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

const CHATBOTS = [
  { id: 'chatgpt', name: 'ChatGPT', app: 'chatgpt://', web: 'https://chatgpt.com/' },
  { id: 'claude', name: 'Claude', app: 'claude://', web: 'https://claude.ai/new' },
  { id: 'gemini', name: 'Gemini', app: 'googlegemini://', web: 'https://gemini.google.com/app' }
];

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? null : Math.round(n * 10) / 10; };

export default function AiPlanScreen() {
  const { profile, bodyweight, updateProfile, choosePlan } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const [sex, setSex] = useState<string>(profile?.sex || '');
  const [age, setAge] = useState(String(profileAge(profile) ?? ''));
  const [height, setHeight] = useState(String(profile?.heightCm ?? ''));
  const [weight, setWeight] = useState(String(currentWeightKg(profile, bodyweight) ?? ''));
  const [goal, setGoal] = useState<AiGoal>((profile?.goalType as AiGoal) || 'recomp');
  const [days, setDays] = useState('3');
  const [level, setLevel] = useState('Intermediate');
  const [equipment, setEquipment] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [problem, setProblem] = useState('');

  const checks: [string, number, number, string][] = [[age, 13, 90, 'Age should be 13–90.'], [height, 100, 250, 'Height should be 100–250 cm.'], [weight, 25, 300, 'Weight should be 25–300 kg.']];
  const invalid = checks.find(([v, lo, hi]) => v.trim() && !(Number(num(v)) >= lo && Number(num(v)) <= hi));

  const copy = async () => {
    if (invalid) { haptic('error'); toast(invalid[3], { error: true }); return; }
    const patch: Record<string, unknown> = { goalType: goal === 'strength' ? 'gain' : goal };
    if (sex) patch.sex = sex;
    if (num(height)) patch.heightCm = num(height);
    if (num(weight)) patch.weightKg = num(weight);
    if (num(age) && !profile?.birthDate) patch.age = Math.round(num(age)!);
    await updateProfile(patch);
    await Clipboard.setStringAsync(buildAiPrompt({ sex, age, height, weight, goal, days, level, equipment, notes, goalKg: profile?.goalKg, activity: profile?.activity }));
    setCopied(true);
    haptic('success');
    toast('Prompt copied. Paste it into your chatbot, then upload the file it gives you.');
  };

  const openBot = async (bot: typeof CHATBOTS[number]) => {
    if (Platform.OS !== 'web') {
      try { await Linking.openURL(bot.app); return; } catch { /* app not installed: the website instead */ }
    }
    Linking.openURL(bot.web).catch(() => {});
  };

  const read = (text: string) => {
    setReply(text);
    if (!text.trim()) { setPlan(null); setProblem(''); return; }
    try {
      setPlan(normalizePlan(extractJson(text)));
      setProblem('');
    } catch (e) {
      setPlan(null);
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };

  const upload = async () => {
    try {
      const text = await pickTextFile();
      if (text !== null) read(text);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't read that file.", { error: true });
    }
  };

  const use = async () => {
    if (!plan) return;
    await choosePlan(plan);
    haptic('success');
    toast(`“${plan.planName}” is now your plan`);
    if (router.canGoBack()) router.back(); else router.replace('/plan');
  };

  const step = (n: number, done: boolean, title: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.accent : c.ink }}>
        <Mono bold color={c.onAccent}>{done ? '✓' : n}</Mono>
      </View>
      <Body bold>{title}</Body>
    </View>
  );

  return (
    <Screen tabBar={false}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Body color={c.accent}>‹ Cancel</Body>
      </Pressable>
      <Header eyebrow="New plan" title="Create with AI" sub="Your details go into a prompt. The chatbot writes the plan; you upload it here." />
      {step(1, !!(sex && age && height && weight), 'About you')}
      <Choices label="Sex" value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" inputMode="numeric" placeholder="30" />
        <Field label="Height cm" value={height} onChangeText={setHeight} keyboardType="decimal-pad" inputMode="decimal" placeholder="174" />
        <Field label="Weight kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" inputMode="decimal" placeholder="70" />
      </View>
      {invalid && <Body style={{ fontSize: 13 }} color={c.danger}>{invalid[3]}</Body>}
      <Choices label="Goal" value={goal} onChange={setGoal} options={(Object.keys(AI_GOALS) as AiGoal[]).map(k => ({ value: k, label: AI_GOALS[k] }))} />
      <Choices label="Days a week" value={days} onChange={setDays} options={['2', '3', '4', '5', '6', '7'].map(d => ({ value: d, label: d }))} />
      <Choices label="Experience" value={level} onChange={setLevel} options={['Beginner', 'Intermediate', 'Advanced'].map(l => ({ value: l, label: l }))} />
      <Field label="Equipment" value={equipment} onChangeText={setEquipment} placeholder="e.g. full gym, or DBs up to 12.5 kg + barbell" />
      <Field label="Focus or notes" value={notes} onChangeText={setNotes} placeholder="e.g. bigger arms, sore left knee, 60 min max" />

      {step(2, copied, 'Copy the prompt')}
      <Button label={copied ? '✓ Copied' : 'Copy prompt'} kind="primary" onPress={copy} />

      {step(3, copied, 'Paste it into a chatbot')}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {CHATBOTS.map(b => <Button key={b.id} label={b.name} onPress={() => openBot(b)} style={{ flex: 1, paddingHorizontal: 8 }} />)}
      </View>
      <Body color={c.inkSoft} style={{ fontSize: 14 }}>It replies with a file called my-plan.json. Download it.</Body>

      {step(4, !!plan, 'Upload the plan')}
      <Button label="Upload my-plan.json" kind={plan ? 'secondary' : 'primary'} onPress={upload} />
      <SectionLabel>Or paste its reply</SectionLabel>
      <TextInput value={reply} onChangeText={read} multiline placeholder="Paste the whole reply here" placeholderTextColor={c.muted} accessibilityLabel="Chatbot reply"
        style={{ minHeight: 110, maxHeight: 220, padding: 12, borderRadius: theme.radius, borderWidth: 1, borderColor: problem ? c.danger : c.line, backgroundColor: c.surface, color: c.ink, fontFamily: theme.fonts.mono, fontSize: 12, textAlignVertical: 'top' }} />
      {problem ? <Body style={{ fontSize: 13 }} color={c.danger} accessibilityLiveRegion="polite">{problem}</Body> : null}
      {plan && (
        <>
          <Card accent>
            <Body bold>✓ {plan.planName}</Body>
            <Mono>{plan.days.length} days · {plan.days.reduce((n, d) => n + d.exercises.length, 0)} exercises</Mono>
          </Card>
          <PlanDays plan={plan} />
          <Button label="Use this plan" kind="primary" onPress={use} />
        </>
      )}
    </Screen>
  );
}
