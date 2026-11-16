import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors } from '@/src/theme';

/**
 * Admin area. Only signed-in platform admins may enter: the whole group is
 * gated here so no admin screen has to duplicate the check.
 */
export default function AdminLayout() {
  useThemeRefresh();
  const { user, loading } = useAuth();

  if (loading) return null;

  const isAdmin =
    Boolean(user?.app_metadata?.is_admin) || Boolean(user?.user_metadata?.is_admin);

  if (!user || user.id === 'demo-user') {
    return <Redirect href="/(auth)/login" />;
  }
  if (!isAdmin) {
    // Signed in, but not an admin.
    return <Redirect href="/(customer)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
