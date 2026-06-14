import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { DigestPreview } from '@/components/notifications/DigestPreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Mail, 
  CheckSquare, 
  XSquare, 
  AlertTriangle, 
  UserCheck, 
  Shield,
  ArrowLeft,
  Loader2,
  CalendarClock,
  Send,
} from 'lucide-react';

export default function NotificationPreferencesPage() {
  const { preferences, isLoading, isSaving, updatePreference } = useNotificationPreferences();
  const { toast } = useToast();
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleSendTestDigest = async () => {
    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-digest', {
        body: { frequency: preferences.email_digest_frequency, test: true },
      });
      if (error) throw error;
      toast({
        title: 'Test Digest Sent',
        description: 'Check your email for a sample digest.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Failed to Send',
        description: error instanceof Error ? error.message : 'Could not send test digest.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Link to="/settings">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Email Notification Preferences</h2>
              <p className="text-muted-foreground">
                Choose which events trigger email notifications
              </p>
            </div>
          </div>
          {isSaving && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Digest Summary Email */}
          <Card className="card-enterprise">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-accent" />
                Activity Digest
              </CardTitle>
              <CardDescription>
                Receive a periodic summary of claim activity instead of individual event emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <CalendarClock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Enable Digest Emails</p>
                    <p className="text-sm text-muted-foreground">
                      Get a bundled summary instead of individual alerts
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_digest_enabled}
                  onCheckedChange={(checked) => updatePreference('email_digest_enabled', checked)}
                />
              </div>
              {preferences.email_digest_enabled && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Digest Frequency</p>
                      <p className="text-sm text-muted-foreground">
                        How often to receive your activity digest
                      </p>
                    </div>
                    <Select
                      value={preferences.email_digest_frequency}
                      onValueChange={(val) => updatePreference('email_digest_frequency', val)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Send Preview</p>
                      <p className="text-sm text-muted-foreground">
                        Send a sample digest to your email now
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendTestDigest}
                      disabled={isSendingTest}
                      className="gap-2"
                    >
                      {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {isSendingTest ? 'Sending...' : 'Send Test'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Digest Preview */}
          {preferences.email_digest_enabled && (
            <DigestPreview frequency={preferences.email_digest_frequency} />
          )}

          <Card className="card-enterprise">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent" />
                Bulk Action Alerts
              </CardTitle>
              <CardDescription>
                Receive emails when bulk actions are performed on claims
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Bulk Approvals</p>
                    <p className="text-sm text-muted-foreground">
                      When multiple claims are approved at once
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_bulk_approved}
                  onCheckedChange={(checked) => updatePreference('email_bulk_approved', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <XSquare className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium">Bulk Rejections</p>
                    <p className="text-sm text-muted-foreground">
                      When multiple claims are rejected at once
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_bulk_rejected}
                  onCheckedChange={(checked) => updatePreference('email_bulk_rejected', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium">Bulk SIU Escalations</p>
                    <p className="text-sm text-muted-foreground">
                      When multiple claims are escalated to SIU investigation
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_bulk_siu_investigation}
                  onCheckedChange={(checked) => updatePreference('email_bulk_siu_investigation', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium">Bulk Reassignments</p>
                    <p className="text-sm text-muted-foreground">
                      When multiple claims are reassigned to another adjuster
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_bulk_reassign}
                  onCheckedChange={(checked) => updatePreference('email_bulk_reassign', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Claim Alerts */}
          <Card className="card-enterprise">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-accent" />
                Claim Alerts
              </CardTitle>
              <CardDescription>
                Individual claim-related email notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium">High-Risk Claim Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      When a new high-risk claim is detected
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_high_risk_alert}
                  onCheckedChange={(checked) => updatePreference('email_high_risk_alert', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium">Claim Reassignment</p>
                    <p className="text-sm text-muted-foreground">
                      When a claim is assigned or reassigned to you
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_claim_reassignment}
                  onCheckedChange={(checked) => updatePreference('email_claim_reassignment', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/50 border-muted">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> In-app notifications are always enabled. These settings only control email delivery. 
                Changes are saved automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
