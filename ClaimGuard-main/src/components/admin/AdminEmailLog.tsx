import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { PostgrestFilterBuilder } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { FileText, CheckCircle2, XCircle, Search, X, RefreshCw, RotateCcw, Loader2, ChevronDown, Download, AlertTriangle } from 'lucide-react';
import { format, subDays, subWeeks, subMonths, subHours } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AdminEmailStats } from './AdminEmailStats';
import { SlaThresholdsConfig } from './SlaThresholdsConfig';

type EmailLogRow = Database['public']['Tables']['email_log']['Row'];
type EmailLogQuery = PostgrestFilterBuilder<EmailLogRow>;

interface EmailLogEntry extends EmailLogRow {
  metadata: Record<string, unknown>;
}

const EMAIL_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'digest', label: 'Digest' },
  { value: 'digest_test', label: 'Digest (Test)' },
  { value: 'bulk_action', label: 'Bulk Action' },
  { value: 'high_risk_alert', label: 'High Risk' },
  { value: 'reassignment', label: 'Reassignment' },
];

const DATE_RANGES = [
  { value: 'all', label: 'All Time' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
];

const PAGE_SIZE = 50;

function escapeCsv(val: string) {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function getDateCutoff(range: string): string | null {
  const now = new Date();
  switch (range) {
    case '24h': return subDays(now, 1).toISOString();
    case '7d': return subWeeks(now, 1).toISOString();
    case '30d': return subMonths(now, 1).toISOString();
    default: return null;
  }
}

export function AdminEmailLog() {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [allLogs, setAllLogs] = useState<EmailLogEntry[]>([]); // for stats
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, statusFilter, dateRange]);

  const loadAllLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('email_log')
        .select<EmailLogRow>('id, email_type, status, error_message, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setAllLogs((data ?? []).map((item) => ({
        ...item,
        metadata: typeof item.metadata === 'object' && item.metadata !== null ? item.metadata as Record<string, unknown> : {},
      })));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadFilteredLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Build filtered count query
      let countQuery = supabase
        .from('email_log')
        .select<EmailLogRow>('*', { count: 'exact', head: true });
      countQuery = applyFilters(countQuery);
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count ?? 0);

      // Build filtered data query
      let dataQuery = supabase.from('email_log').select<EmailLogRow>('*');
      dataQuery = applyFilters(dataQuery);
      dataQuery = dataQuery.order('created_at', { ascending: false }).range(from, to);
      const { data, error } = await dataQuery;
      if (error) throw error;
      setLogs((data ?? []).map((item) => ({
        ...item,
        metadata: typeof item.metadata === 'object' && item.metadata !== null ? item.metadata as Record<string, unknown> : {},
      })));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, applyFilters]);

  useEffect(() => {
    void loadAllLogs();
  }, [loadAllLogs]);

  useEffect(() => {
    void loadFilteredLogs();
  }, [loadFilteredLogs]);

  const applyFilters = useCallback((query: EmailLogQuery) => {
    if (typeFilter !== 'all') {
      query = query.eq('email_type', typeFilter);
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const cutoff = getDateCutoff(dateRange);
    if (cutoff) {
      query = query.gte('created_at', cutoff);
    }
    const searchTerm = debouncedSearch.trim();
    if (searchTerm) {
      query = query.or(`recipient_email.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%`);
    }
    return query;
  }, [typeFilter, statusFilter, dateRange, debouncedSearch]);

  // Failure rate alerting (uses allLogs for broader view)
  const failureAlert = useMemo(() => {
    const oneHourAgo = subHours(new Date(), 1);
    const recentLogs = allLogs.filter(l => new Date(l.created_at) >= oneHourAgo);
    if (recentLogs.length < 5) return null;
    const failedCount = recentLogs.filter(l => l.status === 'failed').length;
    const failureRate = Math.round((failedCount / recentLogs.length) * 100);
    if (failureRate > 20) {
      return { failureRate, failedCount, total: recentLogs.length };
    }
    return null;
  }, [allLogs]);

  async function handleResend(log: EmailLogEntry) {
    setResendingId(log.id);
    try {
      let functionName = 'send-digest';
      const metadata = typeof log.metadata === 'object' && log.metadata !== null ? log.metadata : {};
      const frequency = typeof metadata.frequency === 'string' ? metadata.frequency : 'daily';
      let body: Record<string, unknown> = { test: true };

      if (log.email_type === 'digest' || log.email_type === 'digest_test') {
        functionName = 'send-digest';
        body = { frequency, test: true };
      } else if (log.email_type === 'bulk_action') {
        functionName = 'notify-bulk-action';
        body = { resend: true, original_log_id: log.id };
      } else if (log.email_type === 'high_risk_alert') {
        functionName = 'send-high-risk-alert';
        body = { resend: true, original_log_id: log.id };
      } else if (log.email_type === 'reassignment') {
        functionName = 'notify-reassignment';
        body = { resend: true, original_log_id: log.id };
      }

      const { error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;

      toast({ title: 'Resend triggered', description: `Retrying ${log.email_type} email to ${log.recipient_email}` });
      setTimeout(() => { void loadFilteredLogs(); void loadAllLogs(); }, 2000);
    } catch (error) {
      if (error instanceof Error) {
        toast({ title: 'Resend failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Resend failed', description: 'An unexpected error occurred.', variant: 'destructive' });
      }
    } finally {
      setResendingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasActiveFilters = typeFilter !== 'all' || statusFilter !== 'all' || dateRange !== 'all' || searchQuery.trim() !== '';

  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setDateRange('all');
  };

  const typeLabel = (t: string) => EMAIL_TYPES.find(e => e.value === t)?.label || t;

  const handleExportCsv = useCallback(() => {
    const headers = ['Date', 'Type', 'Recipient', 'Subject', 'Status', 'Error', 'Attempts', 'Metadata'];
    const rows = logs.map(l => {
      const metadata = typeof l.metadata === 'object' && l.metadata !== null ? l.metadata : {};
      const attempts = typeof metadata.attempts === 'number'
        ? metadata.attempts
        : Number(metadata.attempts) || 1;
      return [
        format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss'),
        l.email_type,
        l.recipient_email,
        l.subject || '',
        l.status,
        l.error_message || '',
        String(attempts),
        JSON.stringify(metadata),
      ].map(escapeCsv).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const paginationNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  if (isLoading && logs.length === 0) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <AdminEmailStats logs={allLogs} />
      <SlaThresholdsConfig />

      {/* Failure Rate Alert */}
      {failureAlert && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>High Email Failure Rate</AlertTitle>
          <AlertDescription>
            {failureAlert.failureRate}% of emails failed in the last hour ({failureAlert.failedCount} of {failureAlert.total}).
            Check error details below and verify your email service configuration.
          </AlertDescription>
        </Alert>
      )}

      <Card className="card-enterprise">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                Email Delivery Log
              </CardTitle>
              <CardDescription>
                {hasActiveFilters
                  ? `${totalCount} matching entries (page ${currentPage} of ${totalPages})`
                  : `Page ${currentPage} of ${totalPages} (${totalCount} total entries)`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleExportCsv} title="Export CSV" disabled={logs.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { loadFilteredLogs(); loadAllLogs(); }} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by recipient or subject..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMAIL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>

          {/* Log entries */}
          {logs.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {hasActiveFilters ? 'No emails match your filters' : 'No emails sent yet'}
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {logs.map(log => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <Collapsible key={log.id} open={isExpanded} onOpenChange={(open) => setExpandedId(open ? log.id : null)}>
                      <div className="rounded-lg border border-border hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {log.status === 'sent' ? (
                              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">{typeLabel(log.email_type)}</Badge>
                                <span className="text-sm font-medium truncate">{log.recipient_email}</span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{log.subject}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 ml-3">
                            {log.status === 'failed' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleResend(log); }} disabled={resendingId === log.id} title="Resend">
                                {resendingId === log.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.created_at), 'MMM d, HH:mm')}
                            </span>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-0">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-3 text-xs">
                              <div>
                                <span className="text-muted-foreground">Status</span>
                                <p className={`font-medium ${log.status === 'sent' ? 'text-success' : 'text-destructive'}`}>
                                  {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Type</span>
                                <p className="font-medium text-foreground">{typeLabel(log.email_type)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Sent At</span>
                                <p className="font-medium text-foreground">{format(new Date(log.created_at), 'PPpp')}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Attempts</span>
                                <p className="font-medium text-foreground">{(() => {
                                  const metadata = typeof log.metadata === 'object' && log.metadata !== null ? log.metadata : {};
                                  return typeof metadata.attempts === 'number' ? metadata.attempts : Number(metadata.attempts) || 1;
                                })()}</p>
                              </div>
                              {log.error_message && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Error Message</span>
                                  <p className="font-medium text-destructive break-all whitespace-pre-wrap">{log.error_message}</p>
                                </div>
                              )}
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Metadata</span>
                                  <pre className="mt-1 p-2 rounded bg-muted/50 text-[11px] text-foreground overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {paginationNumbers.map((p, i) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`e-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === currentPage}
                        onClick={() => setCurrentPage(p as number)}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
