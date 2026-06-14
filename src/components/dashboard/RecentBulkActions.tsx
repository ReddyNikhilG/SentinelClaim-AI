import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckSquare, 
  XSquare, 
  AlertTriangle, 
  UserCheck, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface BulkEvent {
  id: string;
  event_data: {
    action: string;
    count: number;
    affected_claim_numbers?: string[];
    assigned_to_name?: string;
    assigned_group?: string | null;
  };
  created_at: string;
}

const ICONS: Record<string, React.ElementType> = {
  bulk_approved: CheckSquare,
  bulk_rejected: XSquare,
  bulk_siu_investigation: AlertTriangle,
  bulk_reassign: UserCheck,
};

const LABELS: Record<string, string> = {
  bulk_approved: 'Approved',
  bulk_rejected: 'Rejected',
  bulk_siu_investigation: 'Escalated',
  bulk_reassign: 'Reassigned',
};

const COLORS: Record<string, string> = {
  bulk_approved: 'text-success',
  bulk_rejected: 'text-destructive',
  bulk_siu_investigation: 'text-warning',
  bulk_reassign: 'text-primary',
};

export function RecentBulkActions() {
  const { userRole } = useAuth();

  const { data: events = [] } = useQuery({
    queryKey: ['recent-bulk-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_events')
        .select('id, event_data, created_at')
        .eq('event_type', 'bulk_action')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as unknown as BulkEvent[];
    },
    enabled: userRole === 'admin',
  });

  if (userRole !== 'admin' || events.length === 0) return null;

  return (
    <Card className="card-enterprise">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Recent Bulk Actions
        </CardTitle>
        <Link to="/activity-log">
          <Button variant="ghost" size="sm" className="gap-1">
            View All <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map(event => {
          const action = event.event_data?.action || 'unknown';
          const Icon = ICONS[action] || Activity;
          const label = LABELS[action] || action;
          const color = COLORS[action] || 'text-muted-foreground';

          return (
            <div key={event.id} className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {label} {event.event_data?.count || 0} claim{(event.event_data?.count || 0) !== 1 ? 's' : ''}
                  {action === 'bulk_reassign' && event.event_data?.assigned_to_name && (
                    <span className="text-muted-foreground font-normal"> → {event.event_data.assigned_to_name}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {event.event_data?.count}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
