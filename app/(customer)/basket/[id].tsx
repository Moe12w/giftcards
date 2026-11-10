import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleDot,
  Gift,
  Link2,
  PartyPopper,
  Plus,
  Share2,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';

import { Badge, type BadgeTone } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { FlowHeader } from '@/src/components/FlowHeader';
import { GiftBox3D } from '@/src/components/GiftBox3D';
import { IconTile, type IconTileTone } from '@/src/components/IconTile';
import { Money } from '@/src/components/Money';
import { ParticipantStack } from '@/src/components/ParticipantStack';
import { Screen } from '@/src/components/Screen';
import { SectionHeader } from '@/src/components/SectionHeader';
import { useAuth } from '@/src/lib/auth';
import { basketProgress, basketTotal, participantTotals, useBaskets } from '@/src/lib/baskets';
import { formatMoney } from '@/src/lib/money';
import { timeAgo } from '@/src/lib/time';
import type { BasketActivityKind, BasketItem, BasketStatus, GiftBasket } from '@/src/lib/types';
import { colors, fonts, fontSizes, radii, spacing } from '@/src/theme';

const STATUS_TONE: Record<BasketStatus, BadgeTone> = {
  open: 'success',
  ready: 'warning',
  completed: 'primary',
};

export default function BasketDetailScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{
    id: string;
    created?: string;
    invite?: string;
    paid?: string;
    sent?: string;
  }>();
  const { user, isDemo } = useAuth();
  const { getBasket, simulateContribution, ready } = useBaskets();
  const basket = params.id ? getBasket(params.id) : null;

  const [selectedItem, setSelectedItem] = useState<BasketItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const simulated = useRef(false);
  const simulateRef = useRef(simulateContribution);

  const lang: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en';
  const rtl = i18n.language === 'ar';
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  // This screen is the last step of the create/pay or send flow. Once the flow
  // has finished, Back should leave it entirely and return to the tabs instead
  // of reopening the previous checkout screen.
  const flowFinished =
    params.created === '1' || params.paid === '1' || params.sent === '1';

  function goBack() {
    if (!flowFinished) {
      router.back();
      return;
    }
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
    router.replace('/(customer)/(tabs)');
  }

  useEffect(() => {
    simulateRef.current = simulateContribution;
  }, [simulateContribution]);

  // Demonstrate real-time collaboration: a friend contributes while the basket
  // is open. Real deployments receive the same event over Supabase Realtime.
  useEffect(() => {
    if (!isDemo) return;
    if (!basket || basket.status !== 'open' || simulated.current) return;
    if (params.created === '1') return;
    const timer = setTimeout(() => {
      if (!basket) return;
      simulated.current = true;
      const item = simulateRef.current(basket.id);
      if (item) {
        setNotice(
          t('basket.justAdded', {
            name: item.added_by_name,
            amount: formatMoney(item.amount_minor, lang),
            vendor: item.vendor_name,
          }),
        );
      }
    }, 9000);
    return () => clearTimeout(timer);
  }, [basket?.id, basket?.status, isDemo, lang, params.created, t]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  // Confirmation after returning from a contribution payment or from sending
  // the finished box. Guarded so re-renders don't replay the toast.
  const flashed = useRef(false);
  useEffect(() => {
    if (flashed.current) return;
    if (params.paid === '1') {
      flashed.current = true;
      setNotice(t('basket.paidNotice'));
    } else if (params.sent === '1') {
      flashed.current = true;
      setNotice(t('basket.sentNotice'));
    }
  }, [params.paid, params.sent, t]);

  const totals = useMemo(() => (basket ? participantTotals(basket) : {}), [basket]);
  const total = basket ? basketTotal(basket) : 0;
  const progress = basket ? basketProgress(basket) : 0;

  if (!ready) {
    return (
      <Screen>
        <FlowHeader title={t('basket.title')} onBack={goBack} />
        <ActivityIndicator color={colors.teal} style={styles.loader} />
      </Screen>
    );
  }

  if (!basket) {
    return (
      <Screen>
        <FlowHeader title={t('basket.title')} onBack={goBack} />
        <EmptyState
          title={t('states.not-found.title')}
          body={t('states.not-found.body')}
          icon="gift"
          tone="lavender"
        />
        <Button label={t('basket.backToBaskets')} onPress={() => router.replace('/(customer)/(tabs)/baskets')} />
      </Screen>
    );
  }

  const isOwner = basket.creator_id === (user?.id ?? 'demo-user');
  const inviteLink = Linking.createURL(`/invite/${basket.code}`);

  async function shareInvite() {
    try {
      await Share.share({
        message: t('basket.shareMessage', {
          name: basket!.recipient_name,
          link: inviteLink,
        }),
        url: inviteLink,
      });
    } catch {
      // The user dismissed the share sheet.
    }
  }

  return (
    <View style={styles.root}>
      <Screen>
        <FlowHeader
          title={basket.name}
          subtitle={t('basket.forRecipient', { name: basket.recipient_name })}
          onBack={goBack}
        />

        {/* Celebration / joined banner */}
        {basket.status !== 'open' ? (
          <Card tone="gold" style={styles.celebration}>
            <View style={styles.celebrationRow}>
              <View style={styles.celebrationIcon}>
                <PartyPopper size={22} color={colors.ink} />
              </View>
              <View style={styles.celebrationCopy}>
                <Text style={styles.celebrationTitle}>
                  {basket.status === 'completed' ? t('basket.completedTitle') : t('basket.readyTitle')}
                </Text>
                <Text style={styles.celebrationBody}>
                  {basket.status === 'completed' ? t('basket.completedBody') : t('basket.readyBody')}
                </Text>
              </View>
            </View>
          </Card>
        ) : params.created === '1' ? (
          <Card tone="teal" style={styles.celebration}>
            <View style={styles.celebrationRow}>
              <View style={styles.celebrationIcon}>
                <CheckCircle2 size={22} color={colors.ink} />
              </View>
              <View style={styles.celebrationCopy}>
                <Text style={styles.celebrationTitle}>{t('basket.createdTitle')}</Text>
                <Text style={styles.celebrationBody}>{t('basket.createdBody')}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Interactive gift box */}
        <Card tone="surface" style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Badge label={t(`basket.status.${basket.status}`)} tone={STATUS_TONE[basket.status]} />
            <Badge label={t(`catalog.occasions.${basket.occasion}`)} tone="primary" />
          </View>

          <GiftBox3D basket={basket} size={270} showMeta={false} />

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{basket.items.length}</Text>
              <Text style={styles.heroStatLabel}>{t('basket.giftCards')}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{basket.participants.length}</Text>
              <Text style={styles.heroStatLabel}>{t('basket.contributors')}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Money minor={total} style={styles.heroTotal} />
              <Text style={styles.heroStatLabel}>{t('basket.totalValue')}</Text>
            </View>
          </View>

          {basket.target_minor > 0 ? (
            <View style={styles.goalWrap}>
              <View style={styles.goalRow}>
                <Text style={styles.goalLabel}>{t('basket.goal')}</Text>
                <Text style={styles.goalValue}>
                  {formatMoney(total, lang)} / {formatMoney(basket.target_minor, lang)}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.goalHint}>
                {progress >= 100 ? t('basket.goalReached') : t('basket.goalRemaining', { percent: progress })}
              </Text>
            </View>
          ) : null}

          <View style={styles.peopleRow}>
            <ParticipantStack participants={basket.participants} size={32} max={5} />
            <Text style={styles.peopleText} numberOfLines={1}>
              {t('basket.byCreator', { name: basket.creator_name })}
            </Text>
          </View>
        </Card>

        {/* Actions */}
        {basket.status !== 'completed' ? (
          <View style={styles.actions}>
            <Button
              label={t('basket.addGift')}
              style={styles.actionButton}
              onPress={() => router.push(`/(customer)/basket/pick?basketId=${basket.id}`)}
            />
            <Button
              label={t('basket.inviteFriends')}
              variant="secondary"
              style={styles.actionButton}
              onPress={shareInvite}
            />
          </View>
        ) : null}

        {/* Invite link */}
        <Card tone="lavender" style={styles.inviteCard}>
          <View style={styles.inviteRow}>
            <View style={styles.inviteIcon}>
              <Link2 size={18} color={colors.ink} />
            </View>
            <View style={styles.inviteCopy}>
              <Text style={styles.inviteLabel}>{t('basket.inviteLink')}</Text>
              <Text style={styles.inviteCode}>{basket.code}</Text>
            </View>
            <Pressable
              onPress={shareInvite}
              accessibilityRole="button"
              accessibilityLabel={t('basket.shareLink')}
              style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
            >
              <Share2 size={16} color={colors.ink} />
            </Pressable>
          </View>
          <Text style={styles.inviteLink} numberOfLines={1}>
            {inviteLink}
          </Text>
          <Text style={styles.inviteHint}>{t('basket.inviteHint')}</Text>
        </Card>

        {/* Gift cards inside */}
        <SectionHeader
          title={t('basket.inside')}
          actionLabel={basket.status !== 'completed' ? t('basket.addShort') : undefined}
          onAction={
            basket.status !== 'completed'
              ? () => router.push(`/(customer)/basket/pick?basketId=${basket.id}`)
              : undefined
          }
        />
        {basket.items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState title={t('basket.noItemsTitle')} body={t('basket.noItemsBody')} icon="gift" tone="lavender" />
            {basket.status !== 'completed' ? (
              <Button
                label={t('basket.addFirstGift')}
                onPress={() => router.push(`/(customer)/basket/pick?basketId=${basket.id}`)}
              />
            ) : null}
          </Card>
        ) : (
          <View style={styles.list}>
            {basket.items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedItem(item)}
                accessibilityRole="button"
                accessibilityLabel={item.vendor_name}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Card style={styles.voucherCard}>
                  <IconTile
                    icon={item.icon}
                    imageUrl={item.logo_url}
                    size={48}
                    tone={(item.tone ?? 'lavender') as IconTileTone}
                  />
                  <View style={styles.voucherCopy}>
                    <Text style={styles.voucherTitle} numberOfLines={1}>
                      {item.vendor_name}
                    </Text>
                    <Text style={styles.voucherMeta} numberOfLines={1}>
                      {t('basket.addedBy', { name: item.added_by_name })}
                    </Text>
                  </View>
                  <View style={styles.voucherRight}>
                    <Money minor={item.amount_minor} style={styles.voucherAmount} />
                    <Arrow size={14} color={colors.ink} />
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {/* Contributions */}
        <SectionHeader title={t('basket.contributions')} />
        <Text style={styles.contributionsHint}>{t('basket.paidHint')}</Text>
        <Card style={styles.contributions}>
          {basket.participants.map((participant, index) => {
            const amount = totals[participant.id] ?? 0;
            const share = total > 0 ? Math.round((amount / total) * 100) : 0;
            return (
              <View
                key={participant.id}
                style={[styles.contributor, index === basket.participants.length - 1 && styles.contributorLast]}
              >
                <ParticipantStack participants={[participant]} size={34} />
                <View style={styles.contributorCopy}>
                  <View style={styles.contributorNameRow}>
                    <Text style={styles.contributorName} numberOfLines={1}>
                      {participant.name}
                    </Text>
                    {participant.is_owner ? <Badge label={t('basket.owner')} tone="success" /> : null}
                  </View>
                  <View style={styles.contributorTrack}>
                    <View style={[styles.contributorFill, { width: `${share}%` }]} />
                  </View>
                </View>
                <Money minor={amount} style={styles.contributorAmount} />
              </View>
            );
          })}
        </Card>

        {/* Activity */}
        <SectionHeader title={t('basket.activity')} />
        <Card style={styles.activityCard}>
          {basket.activity.slice(0, 8).map((entry, index) => (
            <View
              key={entry.id}
              style={[styles.activityRow, index === Math.min(7, basket.activity.length - 1) && styles.activityLast]}
            >
              <View style={styles.activityIcon}>
                <ActivityIcon kind={entry.kind} />
              </View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityText}>
                  {activityText(entry.kind, entry.actor_name, entry.item_title, entry.amount_minor, lang, t)}
                </Text>
                <Text style={styles.activityTime}>{timeAgo(entry.created_at, lang)}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Owner controls */}
        {isOwner && basket.status !== 'completed' ? (
          <Card tone="pink" style={styles.ownerCard}>
            <Text style={styles.ownerTitle}>{t('basket.ownerControls')}</Text>
            <Text style={styles.ownerBody}>
              {t('basket.ownerBody', { name: basket.recipient_name })}
            </Text>
            <Button
              label={t('basket.sendCta')}
              disabled={basket.items.length === 0}
              onPress={() => router.push(`/(customer)/basket/send?id=${basket.id}`)}
            />
            {basket.items.length === 0 ? (
              <Text style={styles.ownerHint}>{t('basket.sendEmptyHint')}</Text>
            ) : null}
          </Card>
        ) : null}

        <Card tone="teal" style={styles.tip}>
          <Users size={18} color={colors.ink} />
          <Text style={styles.tipText}>{t('basket.detailTip')}</Text>
        </Card>
      </Screen>

      {notice ? (
        <View style={styles.toast} pointerEvents="none">
          <Bell size={18} color={colors.ink} />
          <Text style={styles.toastText} numberOfLines={3}>
            {notice}
          </Text>
        </View>
      ) : null}

      {/* Voucher detail modal */}
      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelectedItem(null)}>
          <Pressable style={styles.modalWrap} onPress={(event) => event.stopPropagation()}>
            <Card style={styles.modalCard}>
              <View style={styles.modalTop}>
                <Text style={styles.modalTitle}>{t('basket.voucherTitle')}</Text>
                <Pressable
                  onPress={() => setSelectedItem(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  style={styles.modalClose}
                >
                  <X size={16} color={colors.ink} />
                </Pressable>
              </View>

              {selectedItem ? (
                <>
                  <View style={styles.modalHero}>
                    <IconTile
                      icon={selectedItem.icon}
                      imageUrl={selectedItem.logo_url}
                      size={64}
                      tone={(selectedItem.tone ?? 'lavender') as IconTileTone}
                    />
                    <View style={styles.modalHeroCopy}>
                      <Text style={styles.modalVendor} numberOfLines={1}>
                        {selectedItem.vendor_name}
                      </Text>
                      <Money minor={selectedItem.amount_minor} style={styles.modalAmount} />
                    </View>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>{t('basket.addedByLabel')}</Text>
                    <Text style={styles.modalValue}>{selectedItem.added_by_name}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>{t('basket.addedOn')}</Text>
                    <Text style={styles.modalValue}>{timeAgo(selectedItem.added_at, lang)}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>{t('basket.payment')}</Text>
                    <Badge label={t('basket.paid')} tone="success" />
                  </View>
                  <Button
                    label={t('basket.viewGiftCard')}
                    onPress={() => {
                      const offerId = selectedItem.offer_id;
                      setSelectedItem(null);
                      router.push(`/(customer)/gift/${offerId}`);
                    }}
                  />
                </>
              ) : null}
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActivityIcon({ kind }: { kind: BasketActivityKind }) {
  switch (kind) {
    case 'joined':
      return <UserPlus size={15} color={colors.ink} />;
    case 'item_added':
      return <Plus size={15} color={colors.ink} />;
    case 'ready':
      return <Gift size={15} color={colors.ink} />;
    case 'completed':
      return <CheckCircle2 size={15} color={colors.ink} />;
    default:
      return <CircleDot size={15} color={colors.ink} />;
  }
}

function activityText(
  kind: BasketActivityKind,
  actor: string,
  itemTitle: string | undefined,
  amountMinor: number | undefined,
  lang: 'en' | 'ar',
  t: TFunction,
): string {
  switch (kind) {
    case 'created':
      return t('basket.activityCreated', { name: actor });
    case 'joined':
      return t('basket.activityJoined', { name: actor });
    case 'item_added':
      return t('basket.activityItem', {
        name: actor,
        item: itemTitle ?? '',
        amount: formatMoney(amountMinor ?? 0, lang),
      });
    case 'ready':
      return t('basket.activityReady', { name: actor });
    case 'completed':
      return t('basket.activityCompleted', { name: actor });
    default:
      return actor;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loader: { marginTop: spacing.xxl },
  celebration: {},
  celebrationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  celebrationIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationCopy: { flex: 1, gap: 1 },
  celebrationTitle: { fontFamily: fonts.extrabold, fontSize: fontSizes.md, color: colors.text },
  celebrationBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  heroCard: { gap: spacing.sm, alignItems: 'stretch' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  heroStat: { flex: 1, alignItems: 'center', gap: 0 },
  heroStatValue: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  heroTotal: { fontSize: fontSizes.lg, color: colors.text },
  heroStatLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  heroDivider: { width: 1, height: 28, backgroundColor: colors.borderSoft },
  goalWrap: { gap: spacing.xs },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  goalLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  goalValue: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.text },
  progressTrack: {
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.teal },
  goalHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  peopleText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
  inviteCard: { gap: spacing.xs },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inviteIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCopy: { flex: 1, gap: 0 },
  inviteLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  inviteCode: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: colors.text, letterSpacing: 1 },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteLink: {
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.tealDark,
  },
  inviteHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  list: { gap: spacing.sm },
  voucherCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voucherCopy: { flex: 1, gap: 1 },
  voucherTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  voucherMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  voucherRight: { alignItems: 'flex-end', gap: 2 },
  voucherAmount: { fontSize: fontSizes.md, color: colors.text },
  emptyCard: { gap: spacing.sm },
  contributionsHint: {
    marginTop: -spacing.xs,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  contributions: { paddingVertical: 0 },
  contributor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  contributorLast: { borderBottomWidth: 0 },
  contributorCopy: { flex: 1, gap: 4 },
  contributorNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  contributorName: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text, flexShrink: 1 },
  contributorTrack: {
    height: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  contributorFill: { height: 5, backgroundColor: colors.teal },
  contributorAmount: { fontSize: fontSizes.sm, color: colors.text },
  activityCard: { paddingVertical: 0 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  activityLast: { borderBottomWidth: 0 },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCopy: { flex: 1, gap: 1 },
  activityText: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text, lineHeight: 18 },
  activityTime: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  ownerCard: { gap: spacing.sm },
  ownerTitle: { fontFamily: fonts.extrabold, fontSize: fontSizes.md, color: colors.text },
  ownerBody: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 18 },
  ownerHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text, lineHeight: 18 },
  pressed: { opacity: 0.88, transform: [{ translateY: 2 }] },
  toast: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toastText: { flex: 1, fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.ink },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 28, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalWrap: { width: '100%', maxWidth: 420 },
  modalCard: { gap: spacing.sm },
  modalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  modalTitle: { fontFamily: fonts.extrabold, fontSize: fontSizes.lg, color: colors.text },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modalHeroCopy: { flex: 1, gap: 0 },
  modalVendor: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  modalAmount: { fontSize: fontSizes.xxl, color: colors.text },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  modalLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted },
  modalValue: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
});
