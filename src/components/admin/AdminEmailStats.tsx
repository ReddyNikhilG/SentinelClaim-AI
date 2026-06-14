import React, { useMemo, useState } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, ShieldAlert, Clock, Loader2, Send, History, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format, subDays, startOfDay, subHours } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type SlaSnapshot = Database['public']['Tables']['sla_snapshots']['Row'];
type SlaThresholdRow = Database['public']['Tables']['sla_thresholds']['Row'];

// Chart config types
interface ChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

interface EmailType {
  name: string;
  value: number;
}

interface TrendData {
  date: string;
  sent: number;
  failed: number;
}

interface ErrorBreakdown {
  error: string;
  count: number;
}

interface SlaMetrics {
  avgAttempts: number;
  firstAttemptRate: number;
  multiAttemptCount: number;
  hourlyFailRate: number;
  hourlyTotal: number;
  hourlyFailed: number;
  slaHealthy: boolean;
}

interface EmailLogEntry {
  id: string;
  email_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface AdminEmailStatsProps {
  logs: EmailLogEntry[];
}

const trendChartConfig = {
  sent: { label: 'Sent', color: 'hsl(var(--success, 142 76% 36%))' },
  failed: { label: 'Failed', color: 'hsl(var(--destructive))' },
};

const slaHistoryConfig = {
  success_rate: { label: 'Success Rate', color: 'hsl(var(--primary))' },
  first_attempt_rate: { label: 'First-Attempt Rate', color: 'hsl(var(--success, 142 76% 36%))' },
};

const statusChartConfig = {
  sent: { label: 'Sent', color: 'hsl(var(--success, 142 76% 36%))' },
  failed: { label: 'Failed', color: 'hsl(var(--destructive))' },
};

const TYPE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--warning, 45 93% 47%))',
  'hsl(var(--accent))',
  'hsl(var(--success, 142 76% 36%))',
  'hsl(var(--muted-foreground))',
];

interface SlaThresholds {
  first_attempt_rate_target: number;
  max_hourly_failure_rate: number;
  escalation_consecutive_weeks: number;
}

export function AdminEmailStats({ logs }: AdminEmailStatsProps) {
  const [isCheckingFailure, setIsCheckingFailure] = useState(false);
  const [isSendingSlaReport, setIsSendingSlaReport] = useState(false);
  const [failureCheckResult, setFailureCheckResult] = useState<Record<string, unknown> | null>(null);
  const [slaReportResult, setSlaReportResult] = useState<Record<string, unknown> | null>(null);
  const [slaThresholds, setSlaThresholds] = useState<SlaThresholdRow>({ first_attempt_rate_target: 80, max_hourly_failure_rate: 20, escalation_consecutive_weeks: 2, id: '', failure_alert_min_samples: 5, slack_channel: '#general', updated_at: new Date().toISOString(), updated_by: null });
  const [slaSnapshots, setSlaSnapshots] = useState<SlaSnapshot[]>([]);
  const { toast } = useToast();

  React.useEffect(() => {
    supabase
      .from('sla_thresholds')
      .select<SlaThresholdRow>('first_attempt_rate_target, max_hourly_failure_rate, escalation_consecutive_weeks, id, failure_alert_min_samples, slack_channel, updated_at, updated_by')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSlaThresholds(data);
      });

    supabase
      .from('sla_snapshots')
      .select<SlaSnapshot>('*')
      .order('week_start', { ascending: true })
      .limit(12)
      .then(({ data }) => {
        if (data) setSlaSnapshots(data);
      });
  }, []);

  const { sentCount, failedCount, successRate, typeBreakdown, trendData, errorBreakdown, slaMetrics } = useMemo(() => {
    const sent = logs.filter(l => l.status === 'sent').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const rate = logs.length > 0 ? Math.round((sent / logs.length) * 100) : 0;

    const typeMap = new Map<string, number>();
    logs.forEach(l => typeMap.set(l.email_type, (typeMap.get(l.email_type) || 0) + 1));
    const types = Array.from(typeMap.entries()).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
    })).sort((a, b) => b.value - a.value);

    const trend: { date: string; sent: number; failed: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => format(new Date(l.created_at), 'yyyy-MM-dd') === dayStr);
      trend.push({
        date: format(day, 'MMM d'),
        sent: dayLogs.filter(l => l.status === 'sent').length,
        failed: dayLogs.filter(l => l.status === 'failed').length,
      });
    }

    const errMap = new Map<string, number>();
    logs.filter(l => l.status === 'failed' && l.error_message).forEach(l => {
      const msg = l.error_message!.substring(0, 60);
      errMap.set(msg, (errMap.get(msg) || 0) + 1);
    });
    const errors = Array.from(errMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const sentLogs = logs.filter(l => l.status === 'sent' && l.metadata);
    const attemptCounts = sentLogs.map(l => {
      const metadata = typeof l.metadata === 'object' && l.metadata !== null ? l.metadata as Record<string, unknown> : {};
      return typeof metadata.attempts === 'number' ? metadata.attempts : Number(metadata.attempts) || 1;
    });
    const avgAttempts = attemptCounts.length > 0
      ? attemptCounts.reduce((a, b) => a + b, 0) / attemptCounts.length
      : 0;
    const firstAttemptDelivery = attemptCounts.filter(a => a === 1).length;
    const firstAttemptRate = sentLogs.length > 0 ? Math.round((firstAttemptDelivery / sentLogs.length) * 100) : 100;
    const multiAttemptCount = attemptCounts.filter(a => a > 1).length;

    const oneHourAgo = subHours(new Date(), 1);
    const hourlyLogs = logs.filter(l => new Date(l.created_at) >= oneHourAgo);
    const hourlyFailed = hourlyLogs.filter(l => l.status === 'failed').length;
    const hourlyFailRate = hourlyLogs.length > 0 ? Math.round((hourlyFailed / hourlyLogs.length) * 100) : 0;

    return {
      sentCount: sent,
      failedCount: failed,
      successRate: rate,
      typeBreakdown: types,
      trendData: trend,
      errorBreakdown: errors,
      slaMetrics: {
        avgAttempts: Math.round(avgAttempts * 100) / 100,
        firstAttemptRate,
        multiAttemptCount,
        hourlyFailRate,
        hourlyTotal: hourlyLogs.length,
        hourlyFailed,
        slaHealthy: firstAttemptRate >= slaThresholds.first_attempt_rate_target && hourlyFailRate <= slaThresholds.max_hourly_failure_rate,
      },
    };
  }, [logs, slaThresholds]);

  async function handleRunFailureCheck() {
    setIsCheckingFailure(true);
    setFailureCheckResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('check-email-failure-rate', { body: {} });
      if (error) throw error;
      setFailureCheckResult(data);
      toast({ title: 'Failure check complete', description: (data as { message?: string })?.message || 'Check completed' });
    } catch (error) {
      if (error instanceof Error) {
        toast({ title: 'Check failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Check failed', description: 'An unexpected error occurred.', variant: 'destructive' });
      }
    } finally {
      setIsCheckingFailure(false);
    }
  }

  async function handleSendSlaReport() {
    setIsSendingSlaReport(true);
    setSlaReportResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-sla-report', { body: {} });
      if (error) throw error;
      setSlaReportResult(data);
      toast({ title: 'SLA report sent', description: (data as { message?: string })?.message || 'Report sent to admins' });
      const { data: snaps } = await supabase.from('sla_snapshots').select<SlaSnapshot>('*').order('week_start', { ascending: true }).limit(12);
      if (snaps) setSlaSnapshots(snaps);
    } catch (error) {
      if (error instanceof Error) {
        toast({ title: 'Report failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Report failed', description: 'An unexpected error occurred.', variant: 'destructive' });
      }
    } finally {
      setIsSendingSlaReport(false);
    }
  }

  function exportSlaCsv(snapshots: SlaSnapshot[]) {
    const headers = ['Week Start', 'Total Emails', 'Sent', 'Failed', 'Success Rate %', 'First-Attempt Rate %', 'Avg Attempts', 'SLA Healthy'];
    const rows = [...snapshots].reverse().map(s => [
      s.week_start, s.total_emails, s.sent_count, s.failed_count,
      s.success_rate, s.first_attempt_rate, s.avg_attempts, s.sla_healthy ? 'Yes' : 'No',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sla-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Consecutive degraded weeks count
  const consecutiveDegraded = useMemo(() => {
    const sorted = [...slaSnapshots].sort((a, b) => b.week_start.localeCompare(a.week_start));
    let count = 0;
    for (const s of sorted) {
      if (!s.sla_healthy) count++;
      else break;
    }
    return count;
  }, [slaSnapshots]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="card-enterprise">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{logs.length}</p>
            <p className="text-xs text-muted-foreground">Total Emails</p>
          </CardContent>
        </Card>
        <Card className="card-enterprise">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{sentCount}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card className="card-enterprise">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card className="card-enterprise">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{successRate}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* SLA Tracking + Monitoring Tools */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="card-enterprise">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Delivery SLA Tracking
              <Badge variant={slaMetrics.slaHealthy ? 'default' : 'destructive'} className="ml-auto text-[10px]">
                {slaMetrics.slaHealthy ? 'Healthy' : 'Degraded'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">First-attempt delivery rate</span>
                <span className={`font-medium ${slaMetrics.firstAttemptRate >= 80 ? 'text-success' : slaMetrics.firstAttemptRate >= 50 ? 'text-warning' : 'text-destructive'}`}>
                  {slaMetrics.firstAttemptRate}%
                </span>
              </div>
              <Progress value={slaMetrics.firstAttemptRate} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{slaMetrics.avgAttempts}</p>
                <p className="text-[10px] text-muted-foreground">Avg Attempts</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{slaMetrics.multiAttemptCount}</p>
                <p className="text-[10px] text-muted-foreground">Multi-attempt</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Hourly failure rate</span>
                <span className={`font-medium ${slaMetrics.hourlyFailRate <= 10 ? 'text-success' : slaMetrics.hourlyFailRate <= 20 ? 'text-warning' : 'text-destructive'}`}>
                  {slaMetrics.hourlyFailRate}% ({slaMetrics.hourlyFailed}/{slaMetrics.hourlyTotal})
                </span>
              </div>
              <Progress value={100 - slaMetrics.hourlyFailRate} className="h-2" />
            </div>
            {!slaMetrics.slaHealthy && (
              <p className="text-xs text-destructive/80 bg-destructive/5 rounded p-2">
                ⚠️ SLA targets not met. First-attempt rate should be ≥{slaThresholds.first_attempt_rate_target}% and hourly failure rate ≤{slaThresholds.max_hourly_failure_rate}%.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-enterprise">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Monitoring Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Run on-demand checks or send a test SLA report to all admins.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleRunFailureCheck} disabled={isCheckingFailure} variant="outline" className="gap-2" size="sm">
                {isCheckingFailure ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                Failure Check
              </Button>
              <Button onClick={handleSendSlaReport} disabled={isSendingSlaReport} variant="outline" className="gap-2" size="sm">
                {isSendingSlaReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Test SLA Report
              </Button>
            </div>
            {failureCheckResult && (
              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground">{String(failureCheckResult.message)}</p>
                {failureCheckResult.failureRate !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Failure rate: <span className={`font-medium ${Number(failureCheckResult.failureRate) > 20 ? 'text-destructive' : 'text-success'}`}>
                      {String(failureCheckResult.failureRate)}%
                    </span>
                  </p>
                )}
                {failureCheckResult.adminsNotified !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Admins notified: <span className="font-medium text-foreground">{String(failureCheckResult.adminsNotified)}</span>
                  </p>
                )}
              </div>
            )}
            {slaReportResult && (
              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground">{String(slaReportResult.message)}</p>
                {slaReportResult.successRate !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Success rate: <span className="font-medium text-foreground">{String(slaReportResult.successRate)}%</span>
                    {' · '}First-attempt: <span className="font-medium text-foreground">{String(slaReportResult.firstAttemptRate)}%</span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Delivery Trend */}
        <Card className="card-enterprise">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Delivery Trend (14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendChartConfig} className="h-[200px] w-full">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sent" name="Sent" stroke="var(--color-sent)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failed" name="Failed" stroke="var(--color-failed)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Type Breakdown */}
        <Card className="card-enterprise">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-accent" />
              Email Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typeBreakdown.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No data yet</p>
            ) : (
              <div className="flex items-center gap-4">
                <ChartContainer config={statusChartConfig} className="h-[180px] w-[180px] flex-shrink-0">
                  <PieChart>
                    <Pie data={typeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                      {typeBreakdown.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="space-y-1.5 min-w-0">
                  {typeBreakdown.map((t, i) => (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                      <span className="text-muted-foreground truncate capitalize">{t.name}</span>
                      <span className="font-medium text-foreground ml-auto">{t.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Consecutive Degraded SLA Alert */}
      {consecutiveDegraded >= slaThresholds.escalation_consecutive_weeks && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>SLA Degraded for {consecutiveDegraded} Consecutive Weeks</AlertTitle>
          <AlertDescription>
            Email delivery has not met SLA targets for {consecutiveDegraded} weeks in a row. Immediate investigation is recommended.
          </AlertDescription>
        </Alert>
      )}

      {/* SLA History */}
      {slaSnapshots.length > 0 && (
        <Card className="card-enterprise">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                SLA History (Weekly Snapshots)
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportSlaCsv(slaSnapshots)} title="Export CSV">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChartContainer config={slaHistoryConfig} className="h-[200px] w-full">
              <LineChart data={slaSnapshots.map(s => ({
                ...s,
                week: format(new Date(s.week_start), 'MMM d'),
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} tickFormatter={v => `${v}%`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="success_rate" name="Success Rate" stroke="var(--color-success_rate)" strokeWidth={2} dot />
                <Line type="monotone" dataKey="first_attempt_rate" name="First-Attempt Rate" stroke="var(--color-first_attempt_rate)" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
            {/* Snapshot table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1.5 font-medium">Week</th>
                    <th className="text-right py-1.5 font-medium">Total</th>
                    <th className="text-right py-1.5 font-medium">Sent</th>
                    <th className="text-right py-1.5 font-medium">Failed</th>
                    <th className="text-right py-1.5 font-medium">Success</th>
                    <th className="text-right py-1.5 font-medium">1st Attempt</th>
                    <th className="text-right py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...slaSnapshots].reverse().map(s => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-1.5">{format(new Date(s.week_start), 'MMM d, yyyy')}</td>
                      <td className="text-right">{s.total_emails}</td>
                      <td className="text-right">{s.sent_count}</td>
                      <td className="text-right">{s.failed_count}</td>
                      <td className="text-right">{s.success_rate}%</td>
                      <td className="text-right">{s.first_attempt_rate}%</td>
                      <td className="text-right">
                        <Badge variant={s.sla_healthy ? 'default' : 'destructive'} className="text-[9px]">
                          {s.sla_healthy ? 'Healthy' : 'Degraded'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Breakdown */}
      {errorBreakdown.length > 0 && (
        <Card className="card-enterprise">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-destructive" />
              Top Error Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errorBreakdown.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="h-6 bg-destructive/10 rounded overflow-hidden">
                      <div
                        className="h-full bg-destructive/30 rounded"
                        style={{ width: `${(e.count / errorBreakdown[0].count) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{e.error}</p>
                  </div>
                  <span className="text-sm font-medium text-destructive whitespace-nowrap">{e.count}×</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
