import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Clock, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Claim, ClaimStatus } from '@/types/claims';
import { cn } from '@/lib/utils';
import { useClaims } from '@/hooks/useClaims';
import { formatDistanceToNow } from 'date-fns';

interface RecentClaimActivityProps {
  claims: Claim[];
}

export function RecentClaimActivity({ claims }: RecentClaimActivityProps) {
  const { updateClaim, isUpdating } = useClaims();

  const pendingClaims = claims
    .filter(c => c.status === 'pending' || c.status === 'under_review')
    .slice(0, 5);

  const recentActivity = claims
    .slice(0, 8)
    .map(claim => ({
      id: claim.id,
      claimNumber: claim.claim_number,
      claimantName: claim.claimant_name,
      status: claim.status,
      amount: claim.claim_amount,
      updatedAt: claim.updated_at,
      riskCategory: claim.risk_category,
    }));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  const handleQuickApprove = (claimId: string) => {
    updateClaim({ claimId, updates: { status: 'approved' as ClaimStatus } });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-3.5 w-3.5 text-warning" />;
      case 'under_review': return <Eye className="h-3.5 w-3.5 text-primary" />;
      case 'approved':
      case 'auto_approved': return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
      case 'siu_investigation': return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    under_review: 'Under Review',
    approved: 'Approved',
    auto_approved: 'Auto-Approved',
    rejected: 'Rejected',
    siu_investigation: 'SIU Investigation',
  };

  if (pendingClaims.length === 0 && recentActivity.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pending Claims with Quick Actions */}
      <Card className="card-enterprise">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pending Actions
            {pendingClaims.length > 0 && (
              <span className="ml-auto text-sm font-normal bg-warning/10 text-warning px-2 py-0.5 rounded-full">
                {pendingClaims.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No pending claims — all caught up!</p>
          ) : (
            pendingClaims.map(claim => (
              <div
                key={claim.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <Link to={`/claims/${claim.id}`} className="font-medium text-sm text-primary hover:underline">
                    {claim.claim_number}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {claim.claimant_name} · {formatCurrency(claim.claim_amount)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Link to={`/claims/${claim.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                      <Eye className="h-3 w-3 mr-1" />
                      Review
                    </Button>
                  </Link>
                  {claim.risk_category === 'low' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2 text-success border-success/30 hover:bg-success/5"
                      disabled={isUpdating}
                      onClick={() => handleQuickApprove(claim.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Feed */}
      <Card className="card-enterprise">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-accent" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentActivity.map(item => (
              <Link
                key={item.id}
                to={`/claims/${item.id}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                {getStatusIcon(item.status)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.claimNumber} — {item.claimantName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabels[item.status] || item.status} · {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                  </p>
                </div>
                <span className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded',
                  item.riskCategory === 'high' && 'bg-destructive/10 text-destructive',
                  item.riskCategory === 'medium' && 'bg-warning/10 text-warning',
                  item.riskCategory === 'low' && 'bg-success/10 text-success',
                )}>
                  {item.riskCategory || '-'}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}