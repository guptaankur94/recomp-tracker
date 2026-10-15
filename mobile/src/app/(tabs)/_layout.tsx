import { Redirect } from 'expo-router';

import { useData } from '@/data/store';
import { RestTimerBar } from '@/ui/rest-timer';
import { AppTabs } from '@/ui/tab-bar';

export default function TabsLayout() {
  const { settings, plan, history } = useData();
  // First launch: set up before anything else (people with a plan or workouts already have)
  if (!settings.onboarded && !plan && !history.length) return <Redirect href="/setup" />;
  return (
    <>
      <AppTabs />
      <RestTimerBar />
    </>
  );
}
