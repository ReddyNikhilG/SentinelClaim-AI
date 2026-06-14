import React, { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Download } from 'lucide-react';
import { format, subDays, isAfter, eachDayOfInterval, isSameDay } from 'date-fns';
import { Navigate } from 'react-router-dom';

import { WeeklyStatsBar } from '@/components/activity-log/WeeklyStatsBar';
import { TrendChart } from '@/components/activity-log/TrendChart';
import { ActivityFilters } from '@/components/activity-log/ActivityFilters';
import { EventList } from '@/components/activity-log/EventList';
import { ACTION_CONFIG } from '@/components/activity-log/constants';
import type { BulkActionEvent, Profile } from '@/components/activity-log/types';

export default function ActivityLogPage() {
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['bulk-action-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_events')
        .select('*')
        .eq('event_type', 'bulk_action')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as BulkActionEvent[];
    },
    enabled: userRole === 'admin',
  });

  const performerIds = [...new Set(events.map(e => e.performed_by).filter(Boolean))] as string[];

  const { data: profiles = [] } = useQuery({
    queryKey: ['activity-profiles', performerIds],
    queryFn: async () => {
      if (performerIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', performerIds);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: performerIds.length > 0,
  });

  // Realtime subscription for new bulk action events
  useEffect(() => {
    if (userRole !== 'admin') return;
    const channel = supabase
      .channel('activity-log-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'claim_events', filter: 'event_type=eq.bulk_action' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bulk-action-events'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userRole, queryClient]);

  const weeklyStats = useMemo(() => {
    const weekAgo = subDays(new Date(), 7);
    const thisWeek = events.filter(e => isAfter(new Date(e.created_at), weekAgo));
    const counts: Record<string, number> = {
      bulk_approved: 0, bulk_rejected: 0, bulk_siu_investigation: 0, bulk_reassign: 0,
    };
    let totalClaims = 0;
    thisWeek.forEach(e => {
      const action = e.event_data?.action || '';
      if (counts[action] !== undefined) counts[action]++;
      totalClaims += e.event_data?.count || 0;
    });
    return { counts, total: thisWeek.length, totalClaims };
  }, [events]);

  const trendData = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 29);
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });
    return days.map(day => {
      const dayEvents = events.filter(e => isSameDay(new Date(e.created_at), day));
      const row: Record<string, unknown> = {
        date: format(day, 'MMM d'), fullDate: day,
        approved: 0, rejected: 0, escalated: 0, reassigned: 0,
      };
      dayEvents.forEach(e => {
        const action = e.event_data?.action || '';
        if (action === 'bulk_approved') (row.approved as number)++;
        else if (action === 'bulk_rejected') (row.rejected as number)++;
        else if (action === 'bulk_siu_investigation') (row.escalated as number)++;
        else if (action === 'bulk_reassign') (row.reassigned as number)++;
      });
      return row;
    });
  }, [events]);

  const handleBarClick = (data: Record<string, unknown>) => {
    if (data?.fullDate) {
      const clickedDate = data.fullDate as Date;
      setDateFrom(clickedDate);
      setDateTo(clickedDate);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const action = event.event_data?.action || '';
      if (actionFilter !== 'all' && action !== actionFilter) return false;
      const eventDate = new Date(event.created_at);
      if (dateFrom && eventDate < dateFrom) return false;
      if (dateTo && eventDate > new Date(dateTo.getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [events, actionFilter, dateFrom, dateTo]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, dateFrom, dateTo]);

  const hasFilters = actionFilter !== 'all' || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setActionFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const exportCsv = () => {
    const headers = ['Timestamp', 'Action', 'Claims Count', 'Claim Numbers', 'Performed By', 'Assigned To', 'Assigned Group'];
    const getProfile = (userId: string | null) => profiles.find(p => p.user_id === userId);
    const rows = filteredEvents.map(event => {
      const performer = getProfile(event.performed_by);
      const action = event.event_data?.action || '';
      const config = ACTION_CONFIG[action];
      return [
        new Date(event.created_at).toISOString(),
        config?.label || action,
        String(event.event_data?.count || 0),
        (event.event_data?.affected_claim_numbers || []).join('; '),
        performer?.full_name || event.performed_by || '',
        event.event_data?.assigned_to_name || '',
        event.event_data?.assigned_group || '',
      ];
    });
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (userRole !== 'admin') return <Navigate to="/dashboard" replace />;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Admin Activity Log
            </h2>
            <p className="text-muted-foreground">
              {filteredEvents.length} action{filteredEvents.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Button onClick={exportCsv} disabled={filteredEvents.length === 0} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <WeeklyStatsBar stats={weeklyStats} />
        <TrendChart data={trendData} onBarClick={handleBarClick} />
        <ActivityFilters
          actionFilter={actionFilter}
          setActionFilter={setActionFilter}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          onClear={clearFilters}
          hasFilters={hasFilters}
        />
        <EventList
          events={filteredEvents}
          allEventsEmpty={events.length === 0}
          profiles={profiles}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />
      </div>
    </AppLayout>
  );
}
