import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings2, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SlaThresholds {
  id: string;
  first_attempt_rate_target: number;
  max_hourly_failure_rate: number;
  failure_alert_min_samples: number;
  escalation_consecutive_weeks: number;
  slack_channel: string;
}

export function SlaThresholdsConfig() {
  const [thresholds, setThresholds] = useState<SlaThresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_attempt_rate_target: 80, max_hourly_failure_rate: 20, failure_alert_min_samples: 5, escalation_consecutive_weeks: 2, slack_channel: '#general' });
  const { toast } = useToast();

  useEffect(() => { loadThresholds(); }, []);

  async function loadThresholds() {
    setLoading(true);
    const { data } = await supabase.from('sla_thresholds').select('*').limit(1).maybeSingle();
    if (data) {
      setThresholds(data);
      setForm({
        first_attempt_rate_target: data.first_attempt_rate_target,
        max_hourly_failure_rate: data.max_hourly_failure_rate,
        failure_alert_min_samples: data.failure_alert_min_samples,
        escalation_consecutive_weeks: data.escalation_consecutive_weeks ?? 2,
        slack_channel: data.slack_channel ?? '#general',
      });
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!thresholds) return;
    setSaving(true);
    const { error } = await supabase
      .from('sla_thresholds')
      .update({
        first_attempt_rate_target: form.first_attempt_rate_target,
        max_hourly_failure_rate: form.max_hourly_failure_rate,
        failure_alert_min_samples: form.failure_alert_min_samples,
        escalation_consecutive_weeks: form.escalation_consecutive_weeks,
        slack_channel: form.slack_channel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', thresholds.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'SLA thresholds updated' });
      loadThresholds();
    }
  }

  if (loading) return null;

  return (
    <Card className="card-enterprise">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          SLA Threshold Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">First-attempt rate target (%)</Label>
            <Input
              type="number" min={0} max={100}
              value={form.first_attempt_rate_target}
              onChange={e => setForm(f => ({ ...f, first_attempt_rate_target: Number(e.target.value) }))}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max hourly failure rate (%)</Label>
            <Input
              type="number" min={0} max={100}
              value={form.max_hourly_failure_rate}
              onChange={e => setForm(f => ({ ...f, max_hourly_failure_rate: Number(e.target.value) }))}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Min samples for alert</Label>
            <Input
              type="number" min={1} max={1000}
              value={form.failure_alert_min_samples}
              onChange={e => setForm(f => ({ ...f, failure_alert_min_samples: Number(e.target.value) }))}
              className="h-9"
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Consecutive degraded weeks for escalation</Label>
            <Input
              type="number" min={1} max={52}
              value={form.escalation_consecutive_weeks}
              onChange={e => setForm(f => ({ ...f, escalation_consecutive_weeks: Number(e.target.value) }))}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Slack channel for escalation alerts</Label>
            <Input
              type="text"
              placeholder="#general"
              value={form.slack_channel}
              onChange={e => setForm(f => ({ ...f, slack_channel: e.target.value }))}
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">Channel name or ID (e.g. #sla-alerts)</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Thresholds
        </Button>
      </CardContent>
    </Card>
  );
}
