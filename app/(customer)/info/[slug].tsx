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
  isLegalAudience,
  isLegalDoc,
  LEGAL_AUDIENCES,
  type LegalAudience,
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
    audience?: string;
    doc?: string;
  }>();

  const locale: LegalLocale = i18n.language === 'ar' ? 'ar' : 'en';
  const slug: InfoSlug = isInfoSlug(params.slug) ? params.slug : 'about';

  if (slug === 'terms' || slug === 'privacy' || slug === 'legal') {
    return (
      <LegalScreen
        slug={slug}
        locale={locale}
        audienceParam={params.audience}
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
  audienceParam,
  docParam,
}: {
  slug: 'terms' | 'privacy' | 'legal';
  locale: LegalLocale;
  audienceParam?: string;
  docParam?: string;
}) {
  const { t } = useTranslation();
  const bundle = getLegalBundle(locale);

  // `info/terms` and `info/privacy` open the customer version by default, but
  // the selectors can still switch role and document from the same screen.
  const defaultDoc: LegalDoc = slug === 'privacy' ? 'privacy' : 'terms';
  const audience: LegalAudience = isLegalAudience(audienceParam) ? audienceParam : 'client';
  const doc: LegalDoc = isLegalDoc(docParam) ? docParam : defaultDoc;

  const openDocument = (nextAudience: LegalAudience, nextDoc: LegalDoc) => {
    router.setParams({ audience: nextAudience, doc: nextDoc });
  };

  if (slug === 'legal' && !isLegalAudience(audienceParam) && !isLegalDoc(docParam)) {
    return (
      <Screen>
        <FlowHeader
          title={bundle.ui.legalCentre}
          subtitle={bundle.ui.legalCentreLede}
          onBack={() => router.back()}
        />

        <Card tone="teal">
          <Text style={styles.hubNote}>
            {locale === 'ar'
              ? 'لكل دور شروطه وسياسة خصوصية خاصة به. تنطبق الأقسام العامة على الجميع، ويضيف ملحق دورك الأحكام التي تنطبق على طريقة تعاملك مع المنصة.'
              : 'Each role has its own terms and privacy notice. The general sections apply to everyone, and your role schedule adds the provisions that match the way you use the Platform.'}
          </Text>
        </Card>

        {LEGAL_AUDIENCES.map((entry) => (
          <Card key={entry}>
            <Text style={styles.hubAudience}>{audienceLabel(locale, entry)}</Text>
            <Text style={styles.hubShort}>{audienceShort(locale, entry)}</Text>
            <View style={styles.hubButtons}>
              <Button
                label={t('info.terms.title')}
                onPress={() =>
                  router.push({
                    pathname: '/(customer)/info/[slug]',
                    params: { slug: 'legal', audience: entry, doc: 'terms' },
                  })
                }
              />
              <Button
                label={t('info.privacy.title')}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/(customer)/info/[slug]',
                    params: { slug: 'legal', audience: entry, doc: 'privacy' },
                  })
                }
              />
            </View>
          </Card>
        ))}

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
        onSelectAudience={(nextAudience) => openDocument(nextAudience, document.doc)}
        onSelectDoc={(nextDoc) => openDocument(document.audience, nextDoc)}
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
