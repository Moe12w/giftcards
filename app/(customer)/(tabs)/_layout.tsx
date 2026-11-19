import { useThemeRefresh } from '@/src/lib/theme';
import React from 'react';
import { View } from 'react-native';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Compass, Gift, User, Wallet, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { colors, edges, fonts, fontSizes, radii, themedStyles } from '@/src/theme';

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
  useThemeRefresh();
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
        tabBarInactiveTintColor: colors.textMuted,
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

const styles = themedStyles(() => ({
  // The website's toolbar idiom: a white pill with a 2px ink outline and a
  // hard ink bottom edge, not a coloured bar with a soft drop shadow.
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    height: 70,
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 5,
    borderBottomColor: edges.ink,
    borderRadius: radii.pill,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tabItem: {
    backgroundColor: 'transparent',
    marginHorizontal: 2,
  },
  tabLabel: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xs - 1,
  },
  iconWrap: {
    width: 46,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Active tab is a mint sticker with its own ink outline and hard edge.
  iconWrapActive: {
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 4,
    borderBottomColor: edges.teal,
  },
}));
