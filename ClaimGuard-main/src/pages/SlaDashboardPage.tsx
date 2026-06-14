import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import {
  Activity, AlertTriangle, TrendingUp, TrendingDown, ShieldCheck,
  Clock, Download, FileText, Loader2, Send, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { SlaThresholdsConfig } from '@/components/admin/SlaThresholdsConfig';
import { generateSlaPdf } from '@/lib/slaPdfExport';

interface SlaSnapshot {
  id: string;
  week_start: string;
  total_emails: number;
  sent_count: number;
  failed_count: number;
  success_rate: number;
  first_attempt_rate: number;
  avg_attempts: number;
  sla_healthy: boolean;
  created_at: string;
}

interface SlaThresholds {
  first_attempt_rate_target: number;
  max_hourly_failure_rate: number;
  escalation_consecutive_weeks: number;
}

const trendConfig = {
  success_rate: { label: 'Success Rate', color: 'hsl(var(--primary))' },
  first_attempt_rate: { label: 'First-Attempt Rate', color: 'hsl(var(--success, 142 76% 36%))' },
};

const volumeConfig = {
  sent_count: { label: 'Sent', color: 'hsl(var(--success, 142 76% 36%))' },
  failed_count: { label: 'Failed', color: 'hsl(var(--destructive))' },
};

export default function SlaDashboardPage() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<SlaSnapshot[]>([]);
  const [thresholds, setThresholds] = useState<SlaThresholds>({ first_attempt_rate_target: 80, max_hourly_failure_rate: 20, escalation_consecutive_weeks: 2 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const [realtimeCount, setRealtimeCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: snaps, error: snapsError }, { data: thresh, error: threshError }] = await Promise.all([
        supabase.from<SlaSnapshot>('sla_snapshots').select('*').order('week_start', { ascending: true }).limit(52),
        supabase.from<Pick<SlaThresholds, 'first_attempt_rate_target' | 'max_hourly_failure_rate' | 'escalation_consecutive_weeks'>>('sla_thresholds').select('first_attempt_rate_target, max_hourly_failure_rate, escalation_consecutive_weeks').limit(1).maybeSingle(),
      ]);
      if (snapsError) throw snapsError;
      if (threshError) throw threshError;
      if (snaps) setSnapshots(snaps);
      if (thresh) setThresholds(thresh);
    } catch (error) {
      console.error('Failed to load SLA dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time monitoring: subscribe to email_log changes
  useEffect(() => {
    const channel = supabase
      .channel('sla-email-log-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_log' },
        () => {
          setRealtimeCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-refresh when realtime events accumulate (debounced: every 5 events or 10s)
  useEffect(() => {
    if (realtimeCount === 0) return;
    const timer = setTimeout(() => {
      loadData();
      setRealtimeCount(0);
      toast({ title: '📡 Dashboard refreshed', description: `${realtimeCount} new email event(s) detected` });
    }, realtimeCount >= 5 ? 0 : 10000);
    return () => clearTimeout(timer);
  }, [realtimeCount, loadData, toast]);

  const consecutiveDegraded = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => b.week_start.localeCompare(a.week_start));
    let count = 0;
    for (const s of sorted) {
      if (!s.sla_healthy) count++;
      else break;
    }
    return count;
  }, [snapshots]);

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  const weekOverWeekChange = useMemo(() => {
    if (snapshots.length < 2) return null;
    const curr = snapshots[snapshots.length - 1];
    const prev = snapshots[snapshots.length - 2];
    return {
      successDelta: curr.success_rate - prev.success_rate,
      firstAttemptDelta: curr.first_attempt_rate - prev.first_attempt_rate,
    };
  }, [snapshots]);

  if (userRole !== 'admin') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">Admin access required for SLA Dashboard.</p>
          <Link to="/dashboard"><Button>Back to Dashboard</Button></Link>
        </div>
      </AppLayout>
    );
  }


  async function handleSendReport() {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sla-report', { body: {} });
      if (error) throw error;
      toast({ title: 'SLA report sent', description: data?.message || 'Report dispatched to admins' });
      loadData();
    } catch (error: unknown) {
      toast({ title: 'Failed', description: error instanceof Error ? error.message : 'Failed to send SLA report', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  function exportCsv() {
    const headers = ['Week Start', 'Total', 'Sent', 'Failed', 'Success %', 'First-Attempt %', 'Avg Attempts', 'Healthy'];
    const rows = [...snapshots].reverse().map(s => [
      s.week_start, s.total_emails, s.sent_count, s.failed_count,
      s.success_rate, s.first_attempt_rate, s.avg_attempts, s.sla_healthy ? 'Yes' : 'No',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sla-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = snapshots.map(s => ({
    ...s,
    week: format(new Date(s.week_start), 'MMM d'),
  }));

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">SLA Dashboard</h2>
            <p className="text-muted-foreground">Real-time email delivery performance monitoring</p>
            {realtimeCount > 0 && (
              <Badge variant="outline" className="text-[10px] animate-pulse">
                📡 {realtimeCount} pending update(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={snapshots.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => generateSlaPdf(snapshots, thresholds)} disabled={snapshots.length === 0} className="gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button size="sm" onClick={handleSendReport} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Report
            </Button>
          </div>
        </div>

        {/* Escalation Alert */}
        {consecutiveDegraded >= thresholds.escalation_consecutive_weeks && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>🚨 SLA Escalation: {consecutiveDegraded} Consecutive Degraded Weeks</AlertTitle>
            <AlertDescription>
              Email delivery has missed SLA targets for {consecutiveDegraded} consecutive weeks. Escalation threshold is set to {thresholds.escalation_consecutive_weeks} weeks. Immediate action required.
            </AlertDescription>
          </Alert>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="card-enterprise">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Current Status</p>
                {latestSnapshot && (
                  <Badge variant={latestSnapshot.sla_healthy ? 'default' : 'destructive'} className="text-[10px]">
                    {latestSnapshot.sla_healthy ? 'Healthy' : 'Degraded'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {latestSnapshot?.sla_healthy ? (
                  <ShieldCheck className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
                <p className="text-2xl font-bold text-foreground">{latestSnapshot?.success_rate ?? '—'}%</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Success Rate</p>
            </CardContent>
          </Card>

          <Card className="card-enterprise">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">First-Attempt</p>
              <p className="text-2xl font-bold text-foreground">{latestSnapshot?.first_attempt_rate ?? '—'}%</p>
              {weekOverWeekChange && (
                <div className={`flex items-center gap-1 text-[10px] mt-1 ${weekOverWeekChange.firstAttemptDelta >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {weekOverWeekChange.firstAttemptDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {weekOverWeekChange.firstAttemptDelta > 0 ? '+' : ''}{weekOverWeekChange.firstAttemptDelta}% vs prior week
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-enterprise">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Avg Attempts</p>
              <p className="text-2xl font-bold text-foreground">{latestSnapshot?.avg_attempts ?? '—'}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Per email delivery</p>
            </CardContent>
          </Card>

          <Card className="card-enterprise">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Consecutive Degraded</p>
              <p className={`text-2xl font-bold ${consecutiveDegraded > 0 ? 'text-destructive' : 'text-success'}`}>
                {consecutiveDegraded}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Escalation at ≥{thresholds.escalation_consecutive_weeks} weeks
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="card-enterprise">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                SLA Performance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-12">No snapshots yet. Send a test report to generate data.</p>
              ) : (
                <ChartContainer config={trendConfig} className="h-[250px] w-full">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} tickFormatter={v => `${v}%`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="success_rate" name="Success Rate" stroke="var(--color-success_rate)" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="first_attempt_rate" name="First-Attempt Rate" stroke="var(--color-first_attempt_rate)" strokeWidth={2} dot />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="card-enterprise">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" />
                Weekly Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-12">No data yet</p>
              ) : (
                <ChartContainer config={volumeConfig} className="h-[250px] w-full">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="sent_count" name="Sent" fill="var(--color-sent_count)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed_count" name="Failed" fill="var(--color-failed_count)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly Snapshots with Drill-Down */}
        <Card className="card-enterprise">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Weekly Snapshots (Drill-Down)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {snapshots.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No snapshots recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {[...snapshots].reverse().map(s => (
                  <div key={s.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedWeek(expandedWeek === s.id ? null : s.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={s.sla_healthy ? 'default' : 'destructive'} className="text-[10px]">
                          {s.sla_healthy ? 'Healthy' : 'Degraded'}
                        </Badge>
                        <span className="text-sm font-medium">{format(new Date(s.week_start), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Success: <strong className="text-foreground">{s.success_rate}%</strong></span>
                        <span>1st Attempt: <strong className="text-foreground">{s.first_attempt_rate}%</strong></span>
                        <span>{s.total_emails} emails</span>
                        {expandedWeek === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {expandedWeek === s.id && (
                      <div className="p-4 pt-0 border-t border-border bg-muted/10">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground">Total Emails</p>
                            <p className="text-lg font-bold">{s.total_emails}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground">Delivered</p>
                            <p className="text-lg font-bold text-success">{s.sent_count}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground">Failed</p>
                            <p className="text-lg font-bold text-destructive">{s.failed_count}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground">Avg Attempts</p>
                            <p className="text-lg font-bold">{s.avg_attempts}</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Success Rate</span>
                              <span className={s.success_rate >= (100 - thresholds.max_hourly_failure_rate) ? 'text-success' : 'text-destructive'}>{s.success_rate}%</span>
                            </div>
                            <Progress value={s.success_rate} className="h-2" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">First-Attempt Rate (target: ≥{thresholds.first_attempt_rate_target}%)</span>
                              <span className={s.first_attempt_rate >= thresholds.first_attempt_rate_target ? 'text-success' : 'text-destructive'}>{s.first_attempt_rate}%</span>
                            </div>
                            <Progress value={s.first_attempt_rate} className="h-2" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configurable Thresholds */}
        <SlaThresholdsConfig />
      </div>
    </AppLayout>
  );
}
