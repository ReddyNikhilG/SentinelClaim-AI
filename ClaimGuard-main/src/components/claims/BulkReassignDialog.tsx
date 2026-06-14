import React, { useState } from 'react';
import type { Database } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserCheck } from 'lucide-react';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useClaims } from '@/hooks/useClaims';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type ClaimUpdate = Database['public']['Tables']['claims']['Update'];

interface BulkReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  onComplete: () => void;
}

const GROUPS = [
  'Auto Claims Team',
  'Property Claims Team',
  'Liability Review Team',
  'Special Investigation Unit (SIU)',
];

export function BulkReassignDialog({ open, onOpenChange, selectedIds, onComplete }: BulkReassignDialogProps) {
  const { users, isLoading: usersLoading } = useAdminUsers();
  const { updateClaim, claims } = useClaims();
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);

  const adjusters = users.filter(u => u.role === 'adjuster' || u.role === 'siu_analyst');

  const handleReassign = async () => {
    if (!selectedUser && !selectedGroup) return;
    setIsReassigning(true);

    const updates: Partial<ClaimUpdate> = {};
    if (selectedUser && selectedUser !== 'unassigned') updates.assigned_to = selectedUser;
    if (selectedUser === 'unassigned') updates.assigned_to = null;
    if (selectedGroup) updates.assigned_group = selectedGroup;

    const claimIds = Array.from(selectedIds);
    const promises = claimIds.map(claimId =>
      new Promise<void>((resolve) => {
        updateClaim(
          { claimId, updates },
          { onSettled: () => resolve() }
        );
      })
    );

    await Promise.all(promises);

    // Log bulk reassign event
    const affectedClaims = claims.filter(c => claimIds.includes(c.id));
    const assigneeName = selectedUser && selectedUser !== 'unassigned'
      ? adjusters.find(u => u.user_id === selectedUser)?.full_name || selectedUser
      : 'Unassigned';

    await supabase.from('claim_events').insert({
      claim_id: claimIds[0],
      event_type: 'bulk_action',
      event_data: {
        action: 'bulk_reassign',
        affected_claim_ids: claimIds,
        affected_claim_numbers: affectedClaims.map(c => c.claim_number),
        count: claimIds.length,
        assigned_to: selectedUser || null,
        assigned_to_name: assigneeName,
        assigned_group: selectedGroup || null,
      },
      performed_by: user?.id,
    });

    // Send email notifications (reassignment-specific + bulk action)
    if (selectedUser && selectedUser !== 'unassigned') {
      supabase.functions.invoke('notify-reassignment', {
        body: {
          assigned_to_user_id: selectedUser,
          claim_ids: claimIds,
          claim_numbers: affectedClaims.map(c => c.claim_number),
          assigned_group: selectedGroup || null,
          reassigned_by: user?.id,
        },
      }).catch(err => console.error('Failed to send reassignment notification:', err));
    }

    supabase.functions.invoke('notify-bulk-action', {
      body: {
        action: 'bulk_reassign',
        affected_claim_numbers: affectedClaims.map(c => c.claim_number),
        count: claimIds.length,
        performed_by_name: user?.user_metadata?.full_name || user?.email || 'Unknown',
        assigned_to_name: assigneeName,
        assigned_group: selectedGroup || null,
      },
    }).catch(err => console.error('Bulk action notification failed:', err));

    setIsReassigning(false);
    setSelectedUser('');
    setSelectedGroup('');
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Reassign {selectedIds.size} Claim{selectedIds.size !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Assign selected claims to a specific adjuster and/or group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Assign to Adjuster</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder={usersLoading ? 'Loading...' : 'Select an adjuster'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {adjusters.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name} ({u.role === 'siu_analyst' ? 'SIU' : 'Adjuster'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assign to Group</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleReassign}
            disabled={isReassigning || (!selectedUser && !selectedGroup)}
          >
            {isReassigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reassigning...
              </>
            ) : (
              'Reassign'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
