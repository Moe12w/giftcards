import { useThemeRefresh } from '@/src/lib/theme';
import React from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { FlowHeader } from '@/src/components/FlowHeader';
import { LegalDocumentView } from '@/src/components/LegalDocumentView';
import { Screen } from '@/src/components/Screen';
import {
  audienceLabel,
  audienceShort,
  getLegalBundle,
  getLegalDocument,
  isLegalDoc,
  type LegalDoc,
  type LegalLocale,
} from '@/src/legal';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';

const INFO_SLUGS = ['terms', 'privacy', 'legal', 'about', 'version'] as const;
type InfoSlug = (typeof INFO_SLUGS)[number];

function isInfoSlug(value: string | string[] | undefined): value is InfoSlug {
  return typeof value === 'string' && (INFO_SLUGS as readonly string[]).includes(value);
}

export default function InfoScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{
    slug?: string;
    doc?: string;
  }>();

  const locale: LegalLocale = i18n.language === 'ar' ? 'ar' : 'en';
  const slug: InfoSlug = isInfoSlug(params.slug) ? params.slug : 'about';

  if (slug === 'terms' || slug === 'privacy' || slug === 'legal') {
    return (
      <LegalScreen
        slug={slug}
        locale={locale}
        docParam={params.doc}
      />
    );
  }

  const key = slug;

  return (
    <Screen>
      <FlowHeader title={t(`info.${key}.title`)} onBack={() => router.back()} />

      <Card tone="lavender">
        <Text style={styles.body}>{t(`info.${key}.body`)}</Text>
      </Card>

      <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

function LegalScreen({
  slug,
  locale,
  docParam,
}: {
  slug: 'terms' | 'privacy' | 'legal';
  locale: LegalLocale;
  docParam?: string;
}) {
  const { t } = useTranslation();
  const bundle = getLegalBundle(locale);

  // The app is used by customers, so the legal centre only serves the
  // customer documents. Vendor, enterprise and bulk terms stay on the web.
  const audience = 'client' as const;
  const defaultDoc: LegalDoc = slug === 'privacy' ? 'privacy' : 'terms';
  const doc: LegalDoc = isLegalDoc(docParam) ? docParam : defaultDoc;

  const openDocument = (nextDoc: LegalDoc) => {
    router.setParams({ doc: nextDoc });
  };

  if (slug === 'legal' && !isLegalDoc(docParam)) {
    return (
      <Screen>
        <FlowHeader
          title={bundle.ui.legalCentre}
          subtitle={
            locale === 'ar'
              ? 'الشروط وسياسة الخصوصية التي تنطبق عليك كعميل في Giftly.'
              : 'The terms and privacy policy that apply to you as a Giftly customer.'
          }
          onBack={() => router.back()}
        />

        <Card tone="teal">
          <Text style={styles.hubNote}>
            {locale === 'ar'
              ? 'هذه هي الشروط وسياسة الخصوصية التي تنطبق على العملاء الذين يشترون بطاقات هدايا Giftly أو يرسلونها أو يستلمونها أو يحتفظون بها عبر التطبيق.'
              : 'These are the terms and privacy policy that apply to customers who buy, send, receive or hold a gift card in the Giftly app.'}
          </Text>
        </Card>

        <Card>
          <Text style={styles.hubAudience}>{audienceLabel(locale, 'client')}</Text>
          <Text style={styles.hubShort}>{audienceShort(locale, 'client')}</Text>
          <View style={styles.hubButtons}>
            <Button
              label={t('info.terms.title')}
              onPress={() =>
                router.push({
                  pathname: '/(customer)/info/[slug]',
                  params: { slug: 'legal', doc: 'terms' },
                })
              }
            />
            <Button
              label={t('info.privacy.title')}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/(customer)/info/[slug]',
                  params: { slug: 'legal', doc: 'privacy' },
                })
              }
            />
          </View>
        </Card>

        <Text style={styles.hubMeta}>
          {bundle.ui.lastUpdated}: {bundle.updated} · {bundle.ui.version} ·{' '}
          {bundle.company.legalName} · {locale === 'ar' ? 'السجل التجاري' : 'CR'}{' '}
          {bundle.company.cr}
        </Text>

        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const document = getLegalDocument(locale, audience, doc);

  return (
    <Screen>
      <FlowHeader
        title={document.title}
        subtitle={`${bundle.ui.lastUpdated}: ${document.updated}`}
        onBack={() => router.back()}
      />

      <LegalDocumentView
        document={document}
        locale={locale}
        onSelectDoc={openDocument}
      />

      <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = themedStyles(() => ({
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 22,
  },
  hubNote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 22,
  },
  hubAudience: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
    letterSpacing: -0.2,
  },
  hubShort: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  hubButtons: { gap: spacing.sm, marginTop: spacing.md },
  hubMeta: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
}));
