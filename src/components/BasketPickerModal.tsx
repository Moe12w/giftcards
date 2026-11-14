// src/components/BasketPickerModal.tsx
// Lets the customer choose which open gift box a gift card should join
// before the contribution payment starts.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Gift, Plus, X } from 'lucide-react-native';

import { basketTotal } from '../lib/baskets';
import type { GiftBasket } from '../lib/types';
import { colors, fonts, fontSizes, radii, spacing, themedStyles } from '../theme';
import { Button } from './Button';
import { Money } from './Money';

interface BasketPickerModalProps {
  visible: boolean;
  /** Title of the gift card being added, shown in the sheet header. */
  itemTitle?: string;
  baskets: GiftBasket[];
  /** Id of the basket the card is already in, if any. */
  selectedId?: string | null;
  onClose: () => void;
  onSelect: (basketId: string) => void;
  onCreateNew: () => void;
}

export function BasketPickerModal({
  visible,
  itemTitle,
  baskets,
  selectedId,
  onClose,
  onSelect,
  onCreateNew,
}: BasketPickerModalProps) {
  const { t } = useTranslation();
  const open = baskets.filter((basket) => basket.status !== 'completed');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t('discovery.chooseBasketTitle')}</Text>
              {itemTitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {itemTitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={styles.closeButton}
            >
              <X size={18} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {open.length === 0 ? (
              <Text style={styles.empty}>{t('discovery.chooseBasketEmpty')}</Text>
            ) : (
              open.map((basket) => {
                const active = basket.id === selectedId;
                return (
                  <Pressable
                    key={basket.id}
                    onPress={() => onSelect(basket.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={basket.name}
                    style={({ pressed }) => [
                      styles.row,
                      active && styles.rowActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.rowIcon}>
                      <Gift size={20} color={colors.ink} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {basket.name}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {t('basket.forRecipient', { name: basket.recipient_name })} ·{' '}
                        {t('basket.cardsCount', { count: basket.items.length })}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Money minor={basketTotal(basket)} style={styles.rowAmount} />
                      {active ? <Check size={16} color={colors.ink} /> : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Button
            label={t('discovery.chooseBasketCreate')}
            variant="secondary"
            fullWidth
            onPress={onCreateNew}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 28, 28, 0.45)', justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.md,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerCopy: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { maxHeight: 320 },
  empty: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowActive: { backgroundColor: colors.tealTint },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  rowMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontSize: fontSizes.sm, color: colors.text },
  pressed: { opacity: 0.9 },
}));
