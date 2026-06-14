import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Notification, ClaimStatus } from '@/types/claims';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Statuses that should keep notifications active
const ACTIVE_STATUSES: ClaimStatus[] = ['pending', 'under_review', 'siu_investigation'];

export function useNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();

  const userId = user?.id ?? null;
  const [rawNotifications, setRawNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!userId) {
      setRawNotifications([]);
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const { data: allNotifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notifError) throw notifError;
      const notifications = (allNotifications || []) as Notification[];

      const claimIds = notifications
        .map((n) => n.claim_id)
        .filter((id): id is string => typeof id === 'string');

      if (claimIds.length === 0) {
        setRawNotifications(notifications);
        return;
      }

      const { data: claims } = await supabase
        .from('claims')
        .select('id, status')
        .in('id', claimIds);

      const statusMap: Record<string, ClaimStatus> = {};
      (claims || []).forEach((c) => {
        statusMap[c.id] = c.status as ClaimStatus;
      });

      // Only keep notifications for active claims
      const filtered = notifications.filter((n) => {
        if (!n.claim_id) return true;
        const status = statusMap[n.claim_id];
        if (!status) return true;
        return ACTIVE_STATUSES.includes(status);
      });

      setRawNotifications(filtered);
    } catch (error: unknown) {
      console.error('Failed to load notifications:', error);
      // fail-safe: keep UI usable
      setRawNotifications([]);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const notifChannel = supabase
      .channel(`notifications-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Always reload to keep filtering accurate
          void load();

          if (payload.eventType === 'INSERT') {
            const notification = payload.new as Notification;
            toast({
              title: notification.title,
              description: notification.message,
              variant:
                notification.type === 'warning' || notification.type === 'error'
                  ? 'destructive'
                  : 'default',
            });
          }
        },
      )
      .subscribe();

    const claimChannel = supabase
      .channel('claims-status-updates-for-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'claims',
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(claimChannel);
    };
  }, [userId, load, toast]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
      void load();
    },
    [load],
  );

  const markAllAsRead = useCallback(
    async () => {
      if (!userId) return;
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
      void load();
    },
    [userId, load],
  );

  const notifications = useMemo(() => rawNotifications, [rawNotifications]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: load,
  };
}
