import React, { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyOfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <ActivityIndicator />;
  return <Redirect href={`/(customer)/gift/${id}`} />;
}
