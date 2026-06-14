import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Clock, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ACTION_CONFIG, ITEMS_PER_PAGE } from './constants';
import type { BulkActionEvent, Profile } from './types';

interface EventListProps {
  events: BulkActionEvent[];
  allEventsEmpty: boolean;
  profiles: Profile[];
  currentPage: number;
  setCurrentPage: (fn: (p: number) => number) => void;
}

export function EventList({ events, allEventsEmpty, profiles, currentPage, setCurrentPage }: EventListProps) {
  const totalPages = Math.max(1, Math.ceil(events.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEvents = events.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const getProfile = (userId: string | null) => profiles.find(p => p.user_id === userId);

  if (events.length === 0) {
    return (
      <Card className="card-enterprise">
        <CardContent className="p-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {allEventsEmpty ? 'No bulk actions yet' : 'No actions match filters'}
          </h3>
          <p className="text-muted-foreground">
            {allEventsEmpty
              ? 'Bulk approve, reject, escalate, or reassign claims to see activity here.'
              : "Try adjusting your filters to find what you're looking for."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {paginatedEvents.map(event => {
          const action = event.event_data?.action || 'unknown';
          const config = ACTION_CONFIG[action] || { icon: Activity, label: action, color: 'text-muted-foreground', bgColor: 'bg-muted' };
          const Icon = config.icon;
          const performer = getProfile(event.performed_by);

          return (
            <Card key={event.id} className="card-enterprise">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{config.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {event.event_data?.count || 0} claim{(event.event_data?.count || 0) !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(event.event_data?.affected_claim_numbers || []).map(num => (
                        <Badge key={num} variant="outline" className="text-xs font-mono">{num}</Badge>
                      ))}
                    </div>

                    {action === 'bulk_reassign' && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Assigned to <span className="font-medium text-foreground">{event.event_data?.assigned_to_name || 'Unknown'}</span>
                        {event.event_data?.assigned_group && (
                          <> in <span className="font-medium text-foreground">{event.event_data.assigned_group}</span></>
                        )}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
                        {' · '}
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                      {performer && (
                        <span>by <span className="font-medium text-foreground">{performer.full_name}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">Page {safePage} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
