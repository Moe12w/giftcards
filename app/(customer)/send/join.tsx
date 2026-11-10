import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy entry point for joining a basket. The join experience now lives at
 * /(customer)/basket/join, so old links keep working via a redirect.
 */
export default function SendJoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  if (code) {
    return (
      <Redirect
        href={{ pathname: '/(customer)/basket/join', params: { code } }}
      />
    );
  }
  return <Redirect href="/(customer)/basket/join" />;
}
