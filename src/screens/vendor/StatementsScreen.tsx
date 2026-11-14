/**
 * Vendor Statements Screen
 * 
 * Allows vendors/enterprises to export their transaction data
 * in CSV, JSON, or PDF format for import into accounting software
 * (QuickBooks, Xero, Sage, FreshBooks, etc.) or as formal statements.
 * 
 * Features:
 - Select period: daily, weekly, or monthly
 - Select format: CSV, JSON, or PDF
 - Custom date range picker
 - View generation history
 - Download completed statements
 - Summary totals at top of each statement card
 - PDF statements include formatted table with transaction details
 */

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
  TextInput,
  Alert,
  AppState,
  Platform,
  PixelRatio,
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

// Edge Function URL - replace with your Supabase project ref
// Format: https://<project-ref>.supabase.co/functions/statement-export
const STATEMENT_EDGE_FUNCTION_URL = 'https://your-project-ref.supabase.co/functions/statement-export';

export default function VendorStatementsScreen() {
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

  // Fetch statements from API
  useEffect(() => {
    fetchStatements();
  }, [period, format, dateRange]);

  async function fetchStatements() {
    setLoading(true);
    setRefreshing(true);

    try {
      const { data, error } = await supa
        .from('statements')
        .select('*')
        .eq('vendor_id', user?.id)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setStatements(data || []);
    } catch (e) {
      console.error('Failed to fetch statements:', e);
      Alert.alert(t('states.error.title'), t('states.error.body'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Generate new statement
  async function handleGenerateStatement() {
    setGenerating(true);

    // Calculate period dates based on selection
    let periodStart: Date;
    let periodEnd: Date = dateRange.end;

    switch (period) {
      case 'daily':
        periodStart = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate());
        break;
      case 'weekly':
        // Calculate week start (Sunday of the week containing dateRange.start)
        const startDay = dateRange.start.getDay();
        const startSunday = new Date(dateRange.start);
        startSunday.setDate(dateRange.start.getDate() - startDay);
        periodStart = startSunday;
        // The weekly statement covers 7 days from Sunday
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 6); // inclusive of Saturday
        break;
      case 'monthly':
        periodStart = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1);
        break;
    }

    try {
      // Call the Edge Function to generate statement
      const edgeFunctionUrl = STATEMENT_EDGE_FUNCTION_URL;
      
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

      // Show generation status
      if (data.status === 'generating') {
        // Poll for completion or show message
        Alert.alert(
          t('statements.generating'),
          t('statement_generation_started_please_wait'),
          [{ text: t('common.ok') }]
        );
        setGenerating(false);
      } else if (data.status === 'completed') {
        // Statement ready - show download using the returned URL
        Alert.alert(
          t('statements.ready'),
          `${t('statement_generation_complete')}. ${t('statement_download_now')}`,
          [
            {
              text: t('common.download'),
              onPress: () => {
                // Navigate to download using the edge function's returned URL
                if (data.download_url) {
                  Linking.openURL(data.download_url);
                } else {
                  Alert.alert(t('states.error.title'), 'No download URL available');
                }
              },
            },
            { text: t('common.view') },
          ]
        );
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

  // Open statement details/download
  function handleDownloadStatement(statement: any) {
    // Navigate to download or open URL
    const url = statement.download_url || `/api/statements/${statement.id}?format=${statement.format}`;
    Linking.openURL(url);
  }

  // Refresh control handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatements();
    setRefreshing(false);
  };

  // Format date string
  function formatDate(date: Date | string): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }

  // Share statement (basic implementation)
  function shareStatement(statement: any) {
    Alert.alert(t('statements.shareTitle'), `${t('statements.shareBody')} - ${statement.id}`);
  }

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
      onAppStateChange={onAppStateChange}
    >
      {/* Header with filters */}
      <View style={styles.header}>
        <Card tone="white" style={styles.filterCard}>
          <View style={styles.filterRow}>
            {/* Period selector */}
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>{t('statements.period')}:</Text>
              <FlatList
                data={['daily', 'weekly', 'monthly']}
                keyExtractor={(item, index) => `period-${index}`}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setPeriod(item as 'daily' | 'weekly' | 'monthly');
      setFormat('csv'); // Reset to CSV for new generation
      fetchStatements();
                    }}
                    style={[
                      styles.filterChip,
                      { backgroundColor:
                        period === item as 'daily' | 'weekly' | 'monthly'
                          ? colors.teal
                          : colors.surface,
                    ]}
                  >
                    <Text style={styles.filterChipText}>
                      {t(`statements.period.${item}`)}
                    </Text>
                  </TouchableOpacity>
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.periodChips}
              />
            </View>

            {/* Format selector */}
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

            {/* Date range info */}
            <View style={styles.filterColumn}>
              <Text style={styles.filterSmall}>
                {t('statements.range')}: {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
              </Text>
            </View>

            {/* Generate button */}
            <View style={styles.filterColumn}>
              <TouchableOpacity onPress={handleGenerateStatement} style={styles.generateBtn}>
                <Text style={styles.generateBtnText}>
                  {t('statements.generate')}
                </Text>
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
        </V>
</ScrollView>
  );
}