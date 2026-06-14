import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Claim, ClaimFormData, DashboardStats, ClaimStatus, RiskCategory } from '@/types/claims';
import { calculateFraudScore, determineClaimRouting } from '@/lib/fraudScoring';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useClaims() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all claims
  const { data: claims = [], isLoading, error } = useQuery({
    queryKey: ['claims'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Claim[];
    },
    enabled: !!user,
  });

  // Create new claim
  const createClaimMutation = useMutation({
    mutationFn: async (formData: ClaimFormData) => {
      if (!user) throw new Error('Not authenticated');

      // Calculate fraud score
      const fraudResult = calculateFraudScore(formData);
      const routing = determineClaimRouting(fraudResult.category);

      // Insert claim
      const { data: claim, error: claimError } = await supabase
        .from('claims')
        .insert({
          policy_number: formData.policy_number,
          claim_type: formData.claim_type,
          claim_amount: parseFloat(formData.claim_amount),
          incident_date: formData.incident_date,
          incident_location: formData.incident_location,
          description: formData.description || null,
          claimant_name: formData.claimant_name,
          claimant_email: formData.claimant_email || null,
          claimant_phone: formData.claimant_phone || null,
          risk_score: fraudResult.score,
          risk_category: fraudResult.category,
          assigned_group: routing.assignedGroup,
          status: routing.status,
          created_by: user.id,
        })
        .select()
        .single();

      if (claimError) throw claimError;

      // Insert fraud result
      const { error: fraudError } = await supabase
        .from('fraud_results')
        .insert({
          claim_id: claim.id,
          score: fraudResult.score,
          category: fraudResult.category,
          factors: JSON.parse(JSON.stringify(fraudResult.factors)),
        });

      if (fraudError) console.error('Failed to save fraud result:', fraudError);

      // Create claim event
      const { error: eventError } = await supabase
        .from('claim_events')
        .insert({
          claim_id: claim.id,
          event_type: 'claim_created',
          event_data: {
            fraud_score: fraudResult.score,
            risk_category: fraudResult.category,
            routing: routing.assignedGroup,
          },
          performed_by: user.id,
        });

      if (eventError) console.error('Failed to create event:', eventError);

      // Create notification for high-risk claims
      if (fraudResult.category === 'high') {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'High-Risk Claim Detected',
          message: `Claim ${claim.claim_number} has been flagged with a risk score of ${fraudResult.score}. Routed to SIU for investigation.`,
          type: 'warning',
          claim_id: claim.id,
        });

        // Trigger high-risk alert edge function
        try {
          await supabase.functions.invoke('send-high-risk-alert', {
            body: {
              claim_id: claim.id,
              claim_number: claim.claim_number,
              claimant_name: formData.claimant_name,
              claim_amount: parseFloat(formData.claim_amount),
              risk_score: fraudResult.score,
              risk_category: fraudResult.category,
              user_email: user.email || '',
            },
          });
        } catch (alertError) {
          console.error('Failed to send high-risk alert:', alertError);
        }
      }

      return claim;
    },
    onSuccess: (claim) => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Claim Created Successfully',
        description: `Claim ${claim.claim_number} has been submitted and scored.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error Creating Claim',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update claim status
  const updateClaimMutation = useMutation({
    mutationFn: async ({ claimId, updates }: { claimId: string; updates: Partial<Claim> }) => {
      if (!user) throw new Error('Not authenticated');

      // Get current claim to check status change
      const { data: currentClaim } = await supabase
        .from('claims')
        .select('status, claim_number')
        .eq('id', claimId)
        .single();

      const { data, error } = await supabase
        .from('claims')
        .update(updates)
        .eq('id', claimId)
        .select()
        .single();

      if (error) throw error;

      // Create event for status change
      if (updates.status) {
        await supabase.from('claim_events').insert({
          claim_id: claimId,
          event_type: 'status_changed',
          event_data: { 
            old_status: currentClaim?.status,
            new_status: updates.status 
          },
          performed_by: user.id,
        });

        // If status changed to resolved, delete notifications
        const resolvedStatuses = ['approved', 'auto_approved', 'rejected'];
        if (resolvedStatuses.includes(updates.status)) {
          await supabase
            .from('notifications')
            .delete()
            .eq('claim_id', claimId);
        }

        // If status changed to active, create notification
        const activeStatuses = ['pending', 'under_review', 'siu_investigation'];
        if (activeStatuses.includes(updates.status) && currentClaim?.status !== updates.status) {
          const statusLabels: Record<string, string> = {
            pending: 'Pending Review',
            under_review: 'Under Review',
            siu_investigation: 'SIU Investigation',
          };

          await supabase.from('notifications').insert({
            user_id: user.id,
            title: `Claim Status: ${statusLabels[updates.status]}`,
            message: `Claim ${currentClaim?.claim_number || data.claim_number} is now ${statusLabels[updates.status].toLowerCase()}.`,
            type: updates.status === 'siu_investigation' ? 'warning' : 'info',
            claim_id: claimId,
          });

          // Send email alert when escalated to SIU
          if (updates.status === 'siu_investigation') {
            try {
              await supabase.functions.invoke('send-high-risk-alert', {
                body: {
                  claim_id: claimId,
                  claim_number: currentClaim?.claim_number || data.claim_number,
                  claimant_name: data.claimant_name,
                  claim_amount: data.claim_amount,
                  risk_score: data.risk_score || 0,
                  risk_category: data.risk_category || 'high',
                  user_email: user.email || '',
                  description: data.description || '',
                  incident_location: data.incident_location || '',
                },
              });
            } catch (alertError) {
              console.error('Failed to send SIU escalation alert:', alertError);
            }
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['claim'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Claim Updated',
        description: 'The claim has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error Updating Claim',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Calculate dashboard stats
  const stats: DashboardStats = {
    totalClaims: claims.length,
    pendingClaims: claims.filter(c => c.status === 'pending' || c.status === 'under_review').length,
    approvedClaims: claims.filter(c => c.status === 'approved' || c.status === 'auto_approved').length,
    highRiskClaims: claims.filter(c => c.risk_category === 'high').length,
    totalAmount: claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0),
    avgRiskScore: claims.length > 0 
      ? Math.round(claims.reduce((sum, c) => sum + (c.risk_score || 0), 0) / claims.length)
      : 0,
  };

  return {
    claims,
    isLoading,
    error,
    stats,
    createClaim: createClaimMutation.mutate,
    isCreating: createClaimMutation.isPending,
    updateClaim: updateClaimMutation.mutate,
    isUpdating: updateClaimMutation.isPending,
  };
}

export function useClaim(claimId: string) {
  return useQuery({
    queryKey: ['claim', claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('id', claimId)
        .single();

      if (error) throw error;
      return data as Claim;
    },
    enabled: !!claimId,
  });
}

export function useClaimFraudResult(claimId: string) {
  return useQuery({
    queryKey: ['fraud_result', claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fraud_results')
        .select('*')
        .eq('claim_id', claimId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!claimId,
  });
}

export function useClaimEvents(claimId: string) {
  return useQuery({
    queryKey: ['claim_events', claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_events')
        .select('*')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!claimId,
  });
}
