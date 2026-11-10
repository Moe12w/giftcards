import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Compass, Gift, User, Wallet, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { colors, edges, fonts, fontSizes, radii } from '@/src/theme';

const TAB_ICONS = {
  explore: Compass,
  gift: Gift,
  wallet: Wallet,
  user: User,
} as const;

function renderTabIcon(icon: LucideIcon) {
  const Icon = icon;
  const render = (props: { focused: boolean; color: ColorValue; size: number }): React.ReactElement => (
    <View style={[styles.iconWrap, props.focused && styles.iconWrapActive]}>
      <Icon
        size={props.focused ? 21 : 20}
        color={props.color as string}
        strokeWidth={props.focused ? 2.6 : 2.2}
      />
    </View>
  );
  return render;
}

export default function CustomerTabsLayout() {
  const { t } = useTranslation();

  const exploreIcon = renderTabIcon(TAB_ICONS.explore);
  const giftIcon = renderTabIcon(TAB_ICONS.gift);
  const walletIcon = renderTabIcon(TAB_ICONS.wallet);
  const userIcon = renderTabIcon(TAB_ICONS.user);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: 'rgba(28, 28, 28, 0.6)',
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.explore'),
          tabBarIcon: exploreIcon,
        }}
      />
      <Tabs.Screen
        name="baskets"
        options={{
          title: t('basket.tab'),
          tabBarIcon: giftIcon,
        }}
      />
      <Tabs.Screen
        name="gifts"
        options={{
          title: t('nav.gifts'),
          tabBarIcon: walletIcon,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: userIcon,
        }}
      />

      {/* Legacy routes kept for deep links but hidden from the tab bar. */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="send" options={{ href: null }} />
      <Tabs.Screen name="cards" options={{ href: null }} />
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    height: 68,
    paddingTop: 7,
    paddingBottom: 7,
    paddingHorizontal: 6,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    borderBottomWidth: 6,
    borderBottomColor: edges.teal,
    borderRadius: 999,
    shadowColor: edges.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  tabItem: {
    backgroundColor: 'transparent',
    marginHorizontal: 2,
  },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs - 1,
  },
  iconWrap: {
    width: 44,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A small sticker pill around the active icon instead of a full tab-wide box.
  iconWrapActive: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.ink,
    borderBottomWidth: 4,
    borderBottomColor: edges.teal,
  },
});
