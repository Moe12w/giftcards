// src/components/AnnouncementBanner.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/src/components/Card';
import type { AnnouncementSetting } from '@/src/lib/app-config';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

const DISMISSED_KEY = '@tazilla/announcement-dismissed';

/** Optional home banner. Dismissal is remembered per message, not forever. */
export function AnnouncementBanner({ announcement }: { announcement: AnnouncementSetting }) {
  const { i18n } = useTranslation();
  const text =
    i18n.language === 'ar' ? announcement.textAr || announcement.text : announcement.text;
  // Start hidden so a returning customer never sees a flash of an old message.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((saved) => {
        if (active) setDismissed(saved === text);
      })
      .catch(() => {
        if (active) setDismissed(false);
      });
    return () => {
      active = false;
    };
  }, [text]);

  if (!announcement.enabled || !text || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, text).catch(() => undefined);
  }

  return (
    <Card tone="gold" style={styles.card}>
      <Text style={styles.text}>{text}</Text>
      <Pressable
        onPress={dismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss announcement"
        style={styles.close}
      >
        <X size={16} color={colors.ink} />
      </Pressable>
    </Card>
  );
}

const styles = themedStyles(() => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  close: { padding: 2 },
}));
