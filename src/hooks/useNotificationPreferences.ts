import { useState, useEffect, useCallback } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface NotificationPreferences {
  email_bulk_approved: boolean;
  email_bulk_rejected: boolean;
  email_bulk_siu_investigation: boolean;
  email_bulk_reassign: boolean;
  email_high_risk_alert: boolean;
  email_claim_reassignment: boolean;
  email_digest_enabled: boolean;
  email_digest_frequency: 'daily' | 'weekly';
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_bulk_approved: true,
  email_bulk_rejected: true,
  email_bulk_siu_investigation: true,
  email_bulk_reassign: true,
  email_high_risk_alert: true,
  email_claim_reassignment: true,
  email_digest_enabled: false,
  email_digest_frequency: 'daily',
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from<Database['public']['Tables']['notification_preferences']['Row']>('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setPreferences({
          email_bulk_approved: data.email_bulk_approved,
          email_bulk_rejected: data.email_bulk_rejected,
          email_bulk_siu_investigation: data.email_bulk_siu_investigation,
          email_bulk_reassign: data.email_bulk_reassign,
          email_high_risk_alert: data.email_high_risk_alert,
          email_claim_reassignment: data.email_claim_reassignment,
          email_digest_enabled: data.email_digest_enabled ?? false,
          email_digest_frequency: data.email_digest_frequency ?? 'daily',
        });
      }
    } catch (e) {
      console.error('Failed to load notification preferences:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (prefs: NotificationPreferences) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from<Database['public']['Tables']['notification_preferences']['Insert']>('notification_preferences')
        .upsert({
          user_id: user.id,
          ...prefs,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setPreferences(prefs);
      toast({
        title: 'Preferences Saved',
        description: 'Your notification preferences have been updated.',
      });
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [user, toast]);

  const updatePreference = useCallback(
    (key: keyof NotificationPreferences, value: boolean | string) => {
      const newPrefs = { ...preferences, [key]: value };
      setPreferences(newPrefs);
      void save(newPrefs);
    },
    [preferences, save]
  );

  return { preferences, isLoading, isSaving, save, updatePreference };
}
