// src/components/LegalDocumentView.tsx
// Renders a composed legal document. The same body is used by the app and the
// web dashboards; this component only handles the mobile presentation.
import React from 'react';
import { Text, View } from 'react-native';

import { Card } from './Card';
import { Chip } from './Chip';
import type { LegalDoc, LegalDocument, LegalLocale } from '../legal';
import { LEGAL_DOCS } from '../legal';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';

interface LegalDocumentViewProps {
  document: LegalDocument;
  locale: LegalLocale;
  onSelectDoc: (doc: LegalDoc) => void;
}

export function LegalDocumentView({
  document,
  locale,
  onSelectDoc,
}: LegalDocumentViewProps) {
  const t = document.ui;
  const docLabel = document.doc === 'terms' ? t.terms : t.privacy;

  return (
    <View style={styles.wrapper}>
      <Card tone="lavender">
        <Text style={styles.sectionLabel}>{t.allDocuments}</Text>
        <View style={styles.chips}>
          {LEGAL_DOCS.map((doc) => (
            <Chip
              key={doc}
              label={doc === 'terms' ? t.terms : t.privacy}
              active={doc === document.doc}
              onPress={() => onSelectDoc(doc)}
            />
          ))}
        </View>

        <Text style={styles.meta}>
          {t.lastUpdated}: {document.updated} · {t.version}
        </Text>
      </Card>

      <Card>
        <Text style={styles.docBadge}>{docLabel}</Text>
        {document.intro.map((paragraph, index) => (
          <Text key={`intro-${index}`} style={[styles.paragraph, index === 0 && styles.firstParagraph]}>
            {paragraph}
          </Text>
        ))}
      </Card>

      {document.sections.map((section, sectionIndex) => (
        <Card key={`${section.h}-${sectionIndex}`}>
          <Text style={styles.heading}>{section.h}</Text>
          {section.p.map((paragraph, index) => (
            <Text key={`p-${index}`} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          {section.b?.length ? (
            <View style={styles.bullets}>
              {section.b.map((item, index) => (
                <View key={`b-${index}`} style={styles.bulletRow}>
                  <Text style={styles.bulletMark}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ))}

      <Card tone="gold">
        <Text style={styles.contactHeading}>{locale === 'ar' ? 'التواصل معنا' : 'Contact us'}</Text>
        <Text style={styles.paragraph}>
          {document.company.legalName} · {locale === 'ar' ? 'السجل التجاري' : 'CR'}{' '}
          {document.company.cr} · {document.company.address}
        </Text>
        <Text style={styles.paragraph}>
          {locale === 'ar' ? 'قانوني' : 'Legal'}: {document.company.legalEmail}
        </Text>
        <Text style={styles.paragraph}>
          {locale === 'ar' ? 'الخصوصية' : 'Privacy'}: {document.company.privacyEmail}
        </Text>
        <Text style={[styles.paragraph, styles.lastParagraph]}>
          {locale === 'ar' ? 'الدعم' : 'Support'}: {document.company.supportEmail}
        </Text>
      </Card>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrapper: { gap: spacing.md },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    marginTop: spacing.md,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  docBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealTint,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  heading: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.lg,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.2,
  },
  paragraph: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 23,
    color: colors.text,
    marginTop: spacing.sm,
  },
  firstParagraph: { marginTop: 0 },
  lastParagraph: { marginBottom: 0 },
  bullets: { marginTop: spacing.sm, gap: spacing.sm },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bulletMark: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    lineHeight: 23,
    color: colors.tealDark,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 23,
    color: colors.text,
  },
  contactHeading: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.lg,
    color: colors.text,
    marginBottom: spacing.xs,
  },
}));
