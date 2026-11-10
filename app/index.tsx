import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';

const ONBOARDING_KEY = 'giftly.onboarding.seen';

/**
 * App entry point. First launch shows onboarding, afterwards the customer app.
 * The customer layout handles the auth redirect when Supabase is configured.
 */
export default function Index() {
  const [target, setTarget] = useState<'/(onboarding)/welcome' | '/(customer)/(tabs)' | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((seen) => active && setTarget(seen ? '/(customer)/(tabs)' : '/(onboarding)/welcome'))
      .catch(() => active && setTarget('/(customer)/(tabs)'));
    return () => {
      active = false;
    };
  }, []);

  if (!target) return null;
  return <Redirect href={target} />;
}
