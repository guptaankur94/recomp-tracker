// Profile: the details behind your plan suggestions and daily targets. Every change saves on its own.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ACTIVITY_LEVELS, calcAge, GOAL_TYPES } from '@/core/profile';
import type { ActivityLevel, GoalType, Profile } from '@/core/types';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Choices, Field } from '@/ui/fields';
import { Header, SectionLabel } from '@/ui/parts';
import { Screen } from '@/ui/screen';
import { Targets } from '@/ui/targets';
import { Body, Mono } from '@/ui/text';

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? null : Math.round(n * 10) / 10; };

export default function ProfileScreen() {
  const { profile, updateProfile } = useData();
  const { theme } = useTheme();
  const c = theme.colors;
  const p: Profile = profile || {};
  const [birth] = useState(() => (p.birthDate || '').split('-'));
  const [name, setName] = useState(p.name || '');
  const [day, setDay] = useState(birth[2] ? String(Number(birth[2])) : '');
  const [month, setMonth] = useState(birth[1] ? String(Number(birth[1])) : '');
  const [year, setYear] = useState(birth[0] || '');
  const [height, setHeight] = useState(p.heightCm ? String(p.heightCm) : '');
  const [weight, setWeight] = useState(p.weightKg ? String(p.weightKg) : '');
  const [goalKg, setGoalKg] = useState(p.goalKg ? String(p.goalKg) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const save = async (patch: Partial<Profile>) => {
    await updateProfile(patch);
    setSaved(true);
  };
  const setError = (key: string, msg: string) => setErrors(e => ({ ...e, [key]: msg }));

  // A number field: saved when empty (cleared) or in range, otherwise explained
  const numberField = (key: 'heightCm' | 'weightKg' | 'goalKg', value: string, set: (v: string) => void, lo: number, hi: number, msg: string) => (v: string) => {
    set(v);
    const n = num(v);
    if (!v.trim()) { setError(key, ''); save({ [key]: null }); return; }
    if (n !== null && n >= lo && n <= hi) { setError(key, ''); save({ [key]: n }); }
    else setError(key, msg);
  };

  const setBirth = (d: string, m: string, y: string) => {
    setDay(d); setMonth(m); setYear(y);
    if (!d && !m && !y) { setError('birth', ''); save({ birthDate: '' }); return; }
    if (y.length < 4) return;
    const date = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const real = new Date(`${date}T00:00:00`);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && real.getDate() === Number(d) && real.getMonth() + 1 === Number(m) && calcAge(date) !== null;
    if (valid) { setError('birth', ''); save({ birthDate: date }); }
    else setError('birth', 'Enter a real date: day, month, year.');
  };

  const age = calcAge(p.birthDate);
  return (
    <Screen tabBar={false}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} accessibilityRole="button" accessibilityLabel="Back to Settings" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Body color={c.accent}>‹ Settings</Body>
      </Pressable>
      <Header eyebrow="Settings" title="Profile" sub={saved ? '✓ Saved' : 'Changes save as you go. Everything stays on this phone.'} />
      <Field label="Name" value={name} placeholder="Optional" autoComplete="given-name" onChangeText={v => { setName(v); save({ name: v.trim() }); }} />
      <Choices label="Sex" value={p.sex || ''} onChange={v => save({ sex: v as Profile['sex'] })} columns={2} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field label="Birth day" value={day} placeholder="DD" keyboardType="number-pad" inputMode="numeric" maxLength={2} onChangeText={v => setBirth(v, month, year)} />
          <Field label="Month" value={month} placeholder="MM" keyboardType="number-pad" inputMode="numeric" maxLength={2} onChangeText={v => setBirth(day, v, year)} />
          <Field label="Year" value={year} placeholder="YYYY" keyboardType="number-pad" inputMode="numeric" maxLength={4} onChangeText={v => setBirth(day, month, v)} />
        </View>
        {errors.birth ? <Body style={{ fontSize: 13 }} color={c.danger}>{errors.birth}</Body>
          : <Mono style={{ fontSize: 12 }}>{age ? `Age ${age}` : p.age ? `Age ${p.age} from setup. Add your birth date to keep it current.` : 'Used for your calorie targets.'}</Mono>}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field label="Height (cm)" value={height} placeholder="e.g. 174" keyboardType="decimal-pad" inputMode="decimal" onChangeText={numberField('heightCm', height, setHeight, 100, 250, 'Height should be 100–250 cm.')} />
        <Field label="Weight (kg)" value={weight} placeholder="e.g. 70" keyboardType="decimal-pad" inputMode="decimal" onChangeText={numberField('weightKg', weight, setWeight, 25, 300, 'Weight should be 25–300 kg.')} />
        <Field label="Goal (kg)" value={goalKg} placeholder="e.g. 68" keyboardType="decimal-pad" inputMode="decimal" onChangeText={numberField('goalKg', goalKg, setGoalKg, 25, 300, 'Weight should be 25–300 kg.')} />
      </View>
      {['heightCm', 'weightKg', 'goalKg'].map(k => errors[k] ? <Body key={k} style={{ fontSize: 13 }} color={c.danger}>{errors[k]}</Body> : null)}
      <Choices label="Daily activity" value={p.activity || 'desk'} onChange={v => save({ activity: v })} columns={1}
        options={(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map(k => ({ value: k, label: ACTIVITY_LEVELS[k].label }))} />
      <Choices label="Goal" value={p.goalType || 'recomp'} onChange={v => save({ goalType: v })} columns={1}
        options={(Object.keys(GOAL_TYPES) as GoalType[]).map(k => ({ value: k, label: k === 'recomp' ? 'Body recomposition (lose fat, build muscle)' : GOAL_TYPES[k].label }))} />
      <SectionLabel>Daily targets</SectionLabel>
      <Targets />
    </Screen>
  );
}
