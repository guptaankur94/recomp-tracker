// Daily calorie, protein, fat and carb targets from the profile and latest weigh-in.
import { View } from 'react-native';

import { GOAL_TYPES, nutritionTargets } from '@/core/profile';
import type { GoalType } from '@/core/types';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';

import { Tiles } from './parts';
import { Body } from './text';

export function Targets() {
  const { profile, bodyweight } = useData();
  const { theme } = useTheme();
  const t = profile && nutritionTargets(profile, bodyweight);
  if (!profile || !t) {
    return <Body color={theme.colors.inkSoft} style={{ fontSize: 14 }}>Add sex, birth date (or age), height and weight to see your daily calorie and protein targets.</Body>;
  }
  const goal = (GOAL_TYPES[profile.goalType as GoalType] || GOAL_TYPES.recomp).label.toLowerCase();
  return (
    <View style={{ gap: 8 }}>
      <Tiles tiles={[
        { value: t.calories.toLocaleString('en-US'), label: 'kcal' },
        { value: String(t.protein), unit: 'g', label: 'Protein' },
        { value: String(t.fat), unit: 'g', label: 'Fat' },
        { value: String(t.carbs), unit: 'g', label: 'Carbs' }
      ]} />
      <Body color={theme.colors.inkSoft} style={{ fontSize: 13 }}>
        Daily targets for {goal}. Estimated maintenance: {t.maintenance.toLocaleString('en-US')} kcal. Uses your latest logged bodyweight. Estimates, not prescriptions.
      </Body>
    </View>
  );
}
