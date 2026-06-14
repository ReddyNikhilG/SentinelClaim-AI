import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Upload,
  MessageSquare,
  UserCheck,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClaimEvent {
  id: string;
  event_type: string;
  event_data: unknown;
  created_at: string;
  performed_by: string | null;
}

interface ClaimTimelineProps {
  events: ClaimEvent[] | undefined;
  isLoading: boolean;
  claimCreatedAt: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  claim_created: { icon: FileText, color: 'text-primary bg-primary/10', label: 'Claim Created' },
  status_change: { icon: RefreshCw, color: 'text-accent bg-accent/10', label: 'Status Changed' },
  status_changed: { icon: RefreshCw, color: 'text-accent bg-accent/10', label: 'Status Changed' },
  approved: { icon: CheckCircle2, color: 'text-success bg-success/10', label: 'Claim Approved' },
  auto_approved: { icon: CheckCircle2, color: 'text-success bg-success/10', label: 'Auto-Approved' },
  rejected: { icon: XCircle, color: 'text-destructive bg-destructive/10', label: 'Claim Rejected' },
  siu_investigation: { icon: Shield, color: 'text-warning bg-warning/10', label: 'SIU Investigation' },
  under_review: { icon: Clock, color: 'text-muted-foreground bg-muted', label: 'Under Review' },
  risk_scored: { icon: TrendingUp, color: 'text-warning bg-warning/10', label: 'Risk Scored' },
  document_uploaded: { icon: Upload, color: 'text-primary bg-primary/10', label: 'Document Uploaded' },
  note_added: { icon: MessageSquare, color: 'text-accent bg-accent/10', label: 'Note Added' },
  assigned: { icon: UserCheck, color: 'text-primary bg-primary/10', label: 'Assigned' },
  fraud_analyzed: { icon: AlertTriangle, color: 'text-warning bg-warning/10', label: 'Fraud Analyzed' },
  high_risk_alert_sent: { icon: AlertTriangle, color: 'text-destructive bg-destructive/10', label: 'High-Risk Alert Sent' },
};

const DEFAULT_CONFIG = { icon: Activity, color: 'text-muted-foreground bg-muted', label: 'Event' };

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = '';
  if (diffMins < 1) relative = 'Just now';
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays < 7) relative = `${diffDays}d ago`;
  else relative = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const absolute = date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  return { relative, absolute };
}

function getEventDetails(event: ClaimEvent): string | null {
  const data = event.event_data as Record<string, unknown> | null;
  if (!data) return null;

  if (data.new_status) return `Status → ${String(data.new_status).replace('_', ' ')}`;
  if (data.file_name) return `File: ${String(data.file_name)}`;
  if (data.risk_score) return `Score: ${data.risk_score}/100`;
  if (data.note_type) return `Type: ${String(data.note_type)}`;
  if (data.assigned_to) return `Assigned to: ${String(data.assigned_to)}`;
  return null;
}

export function ClaimTimeline({ events, isLoading, claimCreatedAt }: ClaimTimelineProps) {
  // Build timeline entries: claim creation + events
  const timelineEntries = React.useMemo(() => {
    const entries: ClaimEvent[] = [
      {
        id: 'creation',
        event_type: 'claim_created',
        event_data: null,
        created_at: claimCreatedAt,
        performed_by: null,
      },
    ];
    if (events) entries.push(...events);
    return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [events, claimCreatedAt]);

  return (
    <Card className="card-enterprise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          Activity Timeline
          {events && events.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {timelineEntries.length} events
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : timelineEntries.length > 0 ? (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-5 bottom-5 w-px bg-border" />

            <div className="space-y-1">
              {timelineEntries.map((event, index) => {
                const config = EVENT_CONFIG[event.event_type] || DEFAULT_CONFIG;
                const Icon = config.icon;
                const time = formatDateTime(event.created_at);
                const details = getEventDetails(event);
                const isFirst = index === 0;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      'relative flex gap-4 py-3 px-2 rounded-lg transition-colors hover:bg-muted/30',
                      isFirst && 'bg-muted/20'
                    )}
                  >
                    {/* Icon circle */}
                    <div
                      className={cn(
                        'relative z-10 flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ring-4 ring-card',
                        config.color
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-foreground">
                          {EVENT_CONFIG[event.event_type]?.label || event.event_type.replace(/_/g, ' ')}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap" title={time.absolute}>
                          {time.relative}
                        </span>
                      </div>
                      {details && (
                        <p className="text-xs text-muted-foreground mt-0.5">{details}</p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{time.absolute}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-muted-foreground text-sm">No activity recorded yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
