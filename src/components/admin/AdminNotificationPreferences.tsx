import React, { useEffect, useState } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Mail, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type NotificationPreferencesRow = Database['public']['Tables']['notification_preferences']['Row'];

interface UserPref {
  user_id: string;
  email: string;
  full_name: string;
  email_bulk_approved: boolean;
  email_bulk_rejected: boolean;
  email_bulk_siu_investigation: boolean;
  email_bulk_reassign: boolean;
  email_high_risk_alert: boolean;
  email_claim_reassignment: boolean;
  email_digest_enabled: boolean;
  email_digest_frequency: string;
  has_prefs: boolean;
}

const PREF_LABELS: { key: keyof UserPref; label: string }[] = [
  { key: 'email_bulk_approved', label: 'Bulk Approve' },
  { key: 'email_bulk_rejected', label: 'Bulk Reject' },
  { key: 'email_bulk_siu_investigation', label: 'Bulk SIU' },
  { key: 'email_bulk_reassign', label: 'Bulk Reassign' },
  { key: 'email_high_risk_alert', label: 'High Risk' },
  { key: 'email_claim_reassignment', label: 'Reassignment' },
  { key: 'email_digest_enabled', label: 'Digest' },
];

export function AdminNotificationPreferences() {
  const { toast } = useToast();
  const [userPrefs, setUserPrefs] = useState<UserPref[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select<ProfileRow>('user_id, email, full_name');

      // Get all notification preferences using service-level access
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select<NotificationPreferencesRow>('*');

      const prefMap = new Map((prefs ?? []).map((p) => [p.user_id, p] as const));

      const merged: UserPref[] = (profiles ?? []).map(profile => {
        const pref = prefMap.get(profile.user_id);
        return {
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          email_bulk_approved: pref?.email_bulk_approved ?? true,
          email_bulk_rejected: pref?.email_bulk_rejected ?? true,
          email_bulk_siu_investigation: pref?.email_bulk_siu_investigation ?? true,
          email_bulk_reassign: pref?.email_bulk_reassign ?? true,
          email_high_risk_alert: pref?.email_high_risk_alert ?? true,
          email_claim_reassignment: pref?.email_claim_reassignment ?? true,
          email_digest_enabled: pref?.email_digest_enabled ?? false,
          email_digest_frequency: pref?.email_digest_frequency ?? 'daily',
          has_prefs: !!pref,
        };
      });

      setUserPrefs(merged);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function togglePref(userId: string, key: keyof Omit<NotificationPreferencesRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>, value: boolean) {
    setUpdating(`${userId}-${key}`);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: userId, [key]: value }, { onConflict: 'user_id' });

      if (error) throw error;

      setUserPrefs(prev =>
        prev.map(u => u.user_id === userId ? { ...u, [key]: value, has_prefs: true } : u)
      );
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update preference.', variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <Card className="card-enterprise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-accent" />
          User Notification Preferences
        </CardTitle>
        <CardDescription>
          View and override email notification settings for all users
        </CardDescription>
      </CardHeader>
      <CardContent>
        {userPrefs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No users found</div>
        ) : (
          <div className="space-y-4">
            {/* Header row */}
            <div className="hidden lg:grid lg:grid-cols-[200px_repeat(7,1fr)] gap-2 pb-2 border-b border-border">
              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> User
              </div>
              {PREF_LABELS.map(p => (
                <div key={p.key} className="text-xs font-semibold text-muted-foreground text-center">
                  {p.label}
                </div>
              ))}
            </div>

            {userPrefs.map(user => (
              <div key={user.user_id} className="rounded-lg border border-border p-3 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[200px_repeat(7,1fr)] lg:gap-2 lg:items-center hover:bg-muted/20 transition-colors">
                {/* User info */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {!user.has_prefs && (
                      <Badge variant="outline" className="text-[10px] mt-0.5">Default</Badge>
                    )}
                  </div>
                </div>

                {/* Toggles */}
                {PREF_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between lg:justify-center gap-2">
                    <span className="text-xs text-muted-foreground lg:hidden">{label}</span>
                    <Switch
                      checked={Boolean(user[key])}
                      onCheckedChange={(val) => togglePref(user.user_id, key, val)}
                      disabled={updating === `${user.user_id}-${key}`}
                      className="scale-90"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
