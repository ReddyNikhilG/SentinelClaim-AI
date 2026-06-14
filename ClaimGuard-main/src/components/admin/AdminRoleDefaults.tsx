import React, { useEffect, useState } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type RoleDefaultRow = Database['public']['Tables']['role_default_preferences']['Row'];
type RoleDefaultUpdatableField = keyof Omit<RoleDefaultRow, 'id' | 'created_at' | 'updated_at' | 'role'>;

interface RoleDefault {
  id: string;
  role: string;
  email_bulk_approved: boolean;
  email_bulk_rejected: boolean;
  email_bulk_siu_investigation: boolean;
  email_bulk_reassign: boolean;
  email_high_risk_alert: boolean;
  email_claim_reassignment: boolean;
  email_digest_enabled: boolean;
  email_digest_frequency: string;
}

const TOGGLE_FIELDS: { key: keyof RoleDefault; label: string }[] = [
  { key: 'email_bulk_approved', label: 'Bulk Approve' },
  { key: 'email_bulk_rejected', label: 'Bulk Reject' },
  { key: 'email_bulk_siu_investigation', label: 'Bulk SIU' },
  { key: 'email_bulk_reassign', label: 'Bulk Reassign' },
  { key: 'email_high_risk_alert', label: 'High Risk' },
  { key: 'email_claim_reassignment', label: 'Reassignment' },
  { key: 'email_digest_enabled', label: 'Digest' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  adjuster: 'Adjuster',
  siu_analyst: 'SIU Analyst',
};

export function AdminRoleDefaults() {
  const { toast } = useToast();
  const [defaults, setDefaults] = useState<RoleDefault[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadDefaults();
  }, []);

  async function loadDefaults() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_default_preferences')
        .select<RoleDefaultRow>('*')
        .order('role');
      if (error) throw error;
      setDefaults(data ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateField(roleId: string, key: RoleDefaultUpdatableField, value: boolean | string) {
    setUpdating(`${roleId}-${key}`);
    try {
      const { error } = await supabase
        .from('role_default_preferences')
        .update({ [key]: value })
        .eq('id', roleId);
      if (error) throw error;
      setDefaults(prev => prev.map(d => d.id === roleId ? { ...d, [key]: value } as RoleDefaultRow : d));
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update default.', variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  }

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  }

  return (
    <Card className="card-enterprise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-accent" />
          Role Default Preferences
        </CardTitle>
        <CardDescription>
          Set default notification preferences applied to new users when they join with each role
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Header */}
          <div className="hidden lg:grid lg:grid-cols-[160px_repeat(7,1fr)_100px] gap-2 pb-2 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground">Role</div>
            {TOGGLE_FIELDS.map(f => (
              <div key={f.key} className="text-xs font-semibold text-muted-foreground text-center">{f.label}</div>
            ))}
            <div className="text-xs font-semibold text-muted-foreground text-center">Frequency</div>
          </div>

          {defaults.map(d => (
            <div key={d.id} className="rounded-lg border border-border p-3 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[160px_repeat(7,1fr)_100px] lg:gap-2 lg:items-center hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{ROLE_LABELS[d.role] || d.role}</Badge>
              </div>
              {TOGGLE_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between lg:justify-center gap-2">
                  <span className="text-xs text-muted-foreground lg:hidden">{label}</span>
                  <Switch
                    checked={Boolean(d[key])}
                    onCheckedChange={(val) => updateField(d.id, key, val)}
                    disabled={updating === `${d.id}-${key}`}
                    className="scale-90"
                  />
                </div>
              ))}
              <div className="flex items-center justify-between lg:justify-center">
                <span className="text-xs text-muted-foreground lg:hidden">Frequency</span>
                <Select
                  value={d.email_digest_frequency}
                  onValueChange={(val) => updateField(d.id, 'email_digest_frequency', val)}
                >
                  <SelectTrigger className="h-8 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
