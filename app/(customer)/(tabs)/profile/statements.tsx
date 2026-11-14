import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  RefreshControl,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/lib/auth';
import { useThemeRefresh } from '@/src/lib/theme';
import { supa } from '@/src/lib/supabase';
import { Card, SectionHeader, EmptyState, ListRow } from '@/src/components';
import { colors, fonts, fontSizes, spacing, themedStyles } from '@/src/theme';
import { formatCurrency } from '@/src/lib/statementGenerator';
import { useLinking } from 'expo-linking';
import { Linking, AppState as AppStateNative } from 'react-native';

export default function ProfileStatementsScreen() {
  useThemeRefresh();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [format, setFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  const [generating, setGenerating] = useState(false);
  const [appState, setAppState] = useState<AppStateNative.State | null>(null);
  const onAppStateChange = (nextState: AppStateNative.State) => {
    setAppState(nextState);
  };

  // Fetch statements from edge function
  useEffect(() => {
    fetchStatements();
  }, [period, format, dateRange]);

  async function fetchStatements() {
    setLoading(true);
    setRefreshing(true);

    try {
      const edgeFunctionUrl = 'https://your-project-ref.supabase.co/functions/statement-export';
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId: user?.id,
          period,
          startDate: periodStart.toISOString(),
          endDate: periodEnd.toISOString(),
          format,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(t('states.error.title'), `${t('states.generation_failed')}: ${data.error || response.statusText}`);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (data.status === 'generating') {
        Alert.alert(
          t('statements.generating'),
          t('statement_generation_started_please_wait'),
          [{ text: t('common.ok') }]
        );
        setLoading(false);
        setRefreshing(false);
      } else if (data.status === 'completed') {
        // Upload to Supabase Storage and get URL
        if (data.content_base64) {
          try {
            const base64Data = data.content_base64;
            const base64Clean = base64Data.startsWith('data:') ? base64Data.split(',')[1] : base64Data;
            const binaryString = atob(base64Clean);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            const fileExt = format === 'pdf' ? 'pdf' : format;
            const fileName = `statements/${user?.id}/${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await supa.storage
              .from('your-storage-bucket')
              .upload(fileName, bytes, {
                contentType: format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'text/plain',
              });
            
            if (uploadError) throw new Error(uploadError.message);
            
            const { data: publicUrlData } = await supa.storage
              .from('your-storage-bucket')
              .getPublicUrl(fileName);
            
            // Add to statements list
            const newStatement = {
              id: Date.now().toString(),
              period,
              format,
              status: 'completed',
              download_url: publicUrlData.publicUrl,
              total_amount: data.metadata.total_amount,
              total_fee: data.metadata.total_fee,
              total_vendor_earnings: data.metadata.total_vendor_earnings,
              transaction_count: data.metadata.total_transactions,
            };
            
            setStatements(prev => [newStatement, ...prev]);
          } catch (e) {
            console.error('Error uploading statement:', e);
          }
        }
        setLoading(false);
        setRefreshing(false);
      } else {
        Alert.alert(t('states.error.title'), t('states.error.body'));
        setLoading(false);
        setRefreshing(false);
      }
    } catch (e) {
      console.error('Error fetching statements:', e);
      Alert.alert(t('states.error.title'), t('states.error.body'));
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleGenerateStatement() {
    setGenerating(true);

    let periodStart: Date;
    let periodEnd: Date = dateRange.end;

    switch (period) {
      case 'daily':
        periodStart = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate());
        break;
      case 'weekly':
        const startDay = dateRange.start.getDay();
        const startSunday = new Date(dateRange.start);
        startSunday.setDate(dateRange.start.getDate() - startDay);
        periodStart = startSunday;
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 6);
        break;
      case 'monthly':
        periodStart = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1);
        break;
    }

    try {
      const edgeFunctionUrl = 'https://your-project-ref.supabase.co/functions/statement-export';
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId: user?.id,
          period,
          startDate: periodStart.toISOString(),
          endDate: periodEnd.toISOString(),
          format,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert(t('states.error.title'), `${t('states.generation_failed')}: ${data.error || response.statusText}`);
        setGenerating(false);
        return;
      }

      if (data.status === 'generating') {
        Alert.alert(
          t('statements.generating'),
          t('statement_generation_started_please_wait'),
          [{ text: t('common.ok') }]
        );
        setGenerating(false);
      } else if (data.status === 'completed') {
        // Upload to storage
        if (data.content_base64) {
          try {
            const base64Data = data.content_base64;
            const base64Clean = base64Data.startsWith('data:') ? base64Data.split(',')[1] : base64Data;
            const binaryString = atob(base64Clean);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            const fileExt = format === 'pdf' ? 'pdf' : format;
            const fileName = `statements/${user?.id}/${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await supa.storage
              .from('your-storage-bucket')
              .upload(fileName, bytes, {
                contentType: format === 'csv' ? 'text/csv' : format === 'json' ? 'application/json' : 'text/plain',
              });
            
            if (uploadError) throw new Error(uploadError.message);
            
            const { data: publicUrlData } = await supa.storage
              .from('your-storage-bucket')
              .getPublicUrl(fileName);
            
            Alert.alert(
              t('statements.ready'),
              `${t('statement_generation_complete')}. ${t('statement_download_now')}`,
              [
                {
                  text: t('common.download'),
                  onPress: () => Linking.openURL(publicUrlData.publicUrl),
                },
                { text: t('common.view') },
              ]
            );
          } catch (e) {
            console.error('Error uploading statement:', e);
            Alert.alert(t('states.error.title'), `Failed to upload statement: ${e.message}`);
          }
        }
        setGenerating(false);
      } else {
        Alert.alert(t('states.error.title'), t('states.error.body'));
        setGenerating(false);
      }
    } catch (e) {
      console.error('Error generating statement:', e);
      Alert.alert(t('states.error.title'), t('states.error.body'));
      setGenerating(false);
    }
  }

  // Format date
  function formatDate(date: Date | string): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatements();
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={colors.teal}
        />
      }
    >
      {/* Header with filters */}
      <View style={styles.header}>
        <Card tone="white" style={styles.filterCard}>
          <View style={styles.filterRow}>
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>{t('statements.period')}:</Text>
              <FlatList
                data=['daily', 'weekly', 'monthly']
                keyExtractor={(item, index) => `period-${index}`}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setPeriod(item as 'daily' | 'weekly' | 'monthly');
                      setFormat('csv');
                      fetchStatements();
                    }}
                    style={[
                      styles.filterChip,
                      { backgroundColor: period === item as 'daily' | 'weekly' | 'monthly' ? colors.teal : colors.surface },
                    ]}
                  >
                    <Text style={styles.filterChipText}>{t(`statements.period.${item}`)}</Text>
                  </TouchableOpacity>
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.periodChips}
              />
            </View>

            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>{t('statements.format')}:</Text>
              <View style={styles.formatOptions}>
                <TouchableOpacity
                  onPress={() => { setFormat('csv'); fetchStatements(); }}
                  style={[
                    styles.formatChip,
                    { backgroundColor: format === 'csv' ? colors.teal : colors.surface },
                  ]}
                >
                  <Text style={styles.formatChipText}>{t('statements.format.csv')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setFormat('json'); fetchStatements(); }}
                  style={[
                    styles.formatChip,
                    { backgroundColor: format === 'json' ? colors.teal : colors.surface },
                  ]}
                >
                  <Text style={styles.formatChipText}>{t('statements.format.json')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setFormat('pdf'); fetchStatements(); }}
                  style={[
                    styles.formatChip,
                    { backgroundColor: format === 'pdf' ? colors.teal : colors.surface },
                  ]}
                >
                  <Text style={styles.formatChipText}>{t('statements.format.pdf')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterColumn}>
              <Text style={styles.filterSmall}>
                {t('statements.range')}: {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
              </Text>
            </View>

            <View style={styles.filterColumn}>
              <TouchableOpacity onPress={handleGenerateStatement} style={styles.generateBtn}>
                <Text style={styles.generateBtnText}>{t('statements.generate')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </View>

      {/* Statements list or loading */}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.teal} />
          <Text style={styles.loadingText}>{t('statements.loading')}</Text>
        </View>
      ) : statements.length === 0 ? (
        <EmptyState
          title={t('statements.noStatements')}
          body={t('statements.noStatementsBody')}
          icon="calendar"
          tone="teal"
          buttonLabel={t('statements.generate')}
          onButtonPress={handleGenerateStatement}
        />
      ) : (
        <FlatList
          data={statements}
          keyExtractor={(item) => item.id}
          horizontal={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card tone="white" style={styles.statementCard}>
              <View style={styles.statementHeader}>
                <View style={styles.periodBadge}>
                  <Text style={styles.periodText}>
                    {t(`statements.period.${item.period}`)} {formatDate(
                      new Date(item.start_date),
                    )} - {formatDate(new Date(item.end_date))}
                  </Text>
                </View>
                <View style={styles.statusBadge} tone={item.status === 'completed' ? 'teal' : 'gray'}>
                  {item.status}
                </View>
              </View>

              <View style={styles.statementSummary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('statements.transactions')}</Text>
                  <Text style={styles.summaryValue}>{item.transaction_count}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('statements.totalAmount')}</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(item.total_amount)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('statements.platformFee')}</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(item.total_fee)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('statements.vendorEarnings')}</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(item.total_vendor_earnings)}</Text>
                </View>
              </View>

              <View style={styles.statementActions}>
                <TouchableOpacity onPress={() => Linking.openURL(item.download_url)} style={styles.downloadBtn}>
                  <Text style={styles.downloadBtnText}>{t('statements.download')}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
        />
      )}

      {/* Generating indicator */}
      {generating && (
        <View style={styles.generatingOverlay}>
          <View style={styles.generatingBox}>
            <ActivityIndicator size="small" color={colors.teal} />
            <Text style={styles.generatingText}>{t('statements.generating')}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, padding: spacing.md },
  header: { marginBottom: spacing.md },
  filterCard: { marginBottom: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterColumn: { flex: 1 },
  filterLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.xs },
  periodChips: { flexDirection: 'row', gap: spacing.sm },
  filterChip: { padding: spacing.sm, borderRadius: 8 },
  filterChipText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.white },
  formatOptions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  formatChip: { padding: spacing.sm, borderRadius: 8, minWidth: 80 },
  formatChipText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.white },
  filterSmall: { fontSize: fontSizes.xs, color: colors.textMuted, marginVertical: spacing.xs },
  generateBtn: { padding: spacing.md, backgroundColor: colors.teal, borderRadius: 8, alignItems: 'center' },
  generateBtnText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.white },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: fontSizes.md, color: colors.text },
  list: { marginTop: spacing.md },
  statementCard: { marginBottom: spacing.md },
  statementHeader: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray },
  periodBadge: {},
  periodText: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  statusBadge: { padding: 4, borderRadius: 4 },
  statusText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.white },
  statementSummary: { padding: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  summaryLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  summaryValue: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  statementActions: { padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray },
  downloadBtn: { padding: spacing.sm, backgroundColor: colors.teal, borderRadius: 8, alignItems: 'center' },
  downloadBtnText: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.white },
  generatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatingBox: { padding: spacing.md, backgroundColor: colors.white, borderRadius: 8 },
  generatingText: { fontSize: fontSizes.md, color: colors.teal },
}));