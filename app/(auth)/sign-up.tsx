import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthCardArt } from '@/src/components/AuthCardArt';
import { Button } from '@/src/components/Button';
import { Eyebrow } from '@/src/components/Eyebrow';
import { LanguageToggle } from '@/src/components/LanguageToggle';
import { Screen } from '@/src/components/Screen';
import { SocialSignInButtons } from '@/src/components/SocialSignInButtons';
import { SplashText } from '@/src/components/SplashText';
import { useThemeRefresh } from '@/src/lib/theme';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

/** The first screen of sign-up: a landing-page-style invitation into the flow. */
export default function SignUpScreen() {
  useThemeRefresh();
  const { t } = useTranslation();
  const [socialError, setSocialError] = useState<string | null>(null);

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.topBar}>
        <LanguageToggle />
      </View>

      <View style={styles.copy}>
        <Eyebrow label={t('auth.badgeStart')} tone="lavender" />
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{t('auth.welcomeTitleLine1')}</Text>
          <SplashText fontSize={fontSizes.hero} tone="lavender">
            {t('auth.welcomeTitleLine2')}
          </SplashText>
        </View>
        <Text style={styles.subtitle}>{t('auth.welcomeSubtitle')}</Text>
      </View>

      <AuthCardArt size="hero" />

      <View style={styles.footer}>
        <Button label={t('auth.signUpCta')} onPress={() => router.push('/(auth)/sign-up-email')} />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <SocialSignInButtons onError={setSocialError} />
        {socialError ? <Text style={styles.socialError}>{socialError}</Text> : null}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t('auth.haveAccount')} </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <Text style={styles.link}>{t('auth.signIn')}</Text>
            </Pressable>
          </Link>
        </View>
        <Pressable
          onPress={() => router.replace('/(customer)/(tabs)')}
          accessibilityRole="link"
          hitSlop={8}
          style={styles.browseRow}
        >
          <Text style={styles.link}>{t('auth.continueBrowsing')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  content: { flex: 1, paddingTop: spacing.md, paddingBottom: spacing.lg },
  topBar: { alignItems: 'flex-end' },
  copy: { gap: spacing.sm, alignItems: 'flex-start' },
  titleGroup: { gap: 0 },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.hero,
    lineHeight: 42,
    color: colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
  footer: { gap: spacing.md, marginTop: 'auto' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dividerLine: { flex: 1, height: 2, backgroundColor: colors.borderSoft },
  dividerText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  socialError: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  browseRow: { alignSelf: 'center', paddingVertical: spacing.xs },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  link: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.tealDark },
}));
