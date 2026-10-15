// A plan read from a file, shown before it replaces the current one.
import { router } from 'expo-router';

import { hasDraft } from '@/core/draft';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { haptic } from '@/ui/haptics';
import { Header } from '@/ui/parts';
import { PlanDays } from '@/ui/plan-days';
import { Card, Screen } from '@/ui/screen';
import { Body } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function PlanPreviewScreen() {
  const { pendingPlan, setPendingPlan, choosePlan, drafts } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const close = () => { setPendingPlan(null); if (router.canGoBack()) router.back(); else router.replace('/plan'); };
  if (!pendingPlan) {
    return (
      <Screen tabBar={false}>
        <Body color={theme.colors.inkSoft}>There&apos;s no plan to show.</Body>
        <Button label="Back" onPress={close} />
      </Screen>
    );
  }
  const total = pendingPlan.days.reduce((n, d) => n + d.exercises.length, 0);
  const use = async () => {
    await choosePlan(pendingPlan);
    haptic('success');
    toast(`“${pendingPlan.planName}” is now your plan`);
    close();
  };
  return (
    <Screen tabBar={false}>
      <Header eyebrow="New plan" title={pendingPlan.planName} sub={`${pendingPlan.days.length} days · ${total} exercises`} />
      <PlanDays plan={pendingPlan} />
      {Object.values(drafts).some(d => hasDraft(d)) && (
        <Card><Body color={theme.colors.inkSoft} style={{ fontSize: 14 }}>Unsaved sets in your current workout will be cleared. Saved history is kept.</Body></Card>
      )}
      <Button label="Use this plan" kind="primary" onPress={use} />
      <Button label="Cancel" onPress={close} />
    </Screen>
  );
}
