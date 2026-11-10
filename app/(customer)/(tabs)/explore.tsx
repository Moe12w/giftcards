import React from 'react';
import { Redirect } from 'expo-router';

/**
 * The Explore experience now lives on the tabs index route. This file remains
 * so older deep links to the explore tab keep working.
 */
export default function ExploreRedirect() {
  return <Redirect href="/(customer)/(tabs)" />;
}
