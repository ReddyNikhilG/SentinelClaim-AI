import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useClaims } from '@/hooks/useClaims';
import { useRealtimeClaims } from '@/hooks/useRealtimeClaims';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Eye,
  CheckSquare,
  PieChart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClaimActivityHeatmap } from '@/components/dashboard/ClaimActivityHeatmap';
import { RecentClaimActivity } from '@/components/dashboard/RecentClaimActivity';
import { RecentBulkActions } from '@/components/dashboard/RecentBulkActions';

export default function DashboardPage() {
  useRealtimeClaims();
  const { claims, stats, isLoading } = useClaims();

  const recentClaims = claims.slice(0, 5);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: 'status-badge status-pending',
      under_review: 'status-badge status-under-review',
      approved: 'status-badge status-approved',
      auto_approved: 'status-badge status-approved',
      rejected: 'status-badge status-rejected',
      siu_investigation: 'status-badge status-siu',
    };
    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      under_review: 'Under Review',
      approved: 'Approved',
      auto_approved: 'Auto-Approved',
      rejected: 'Rejected',
      siu_investigation: 'SIU Investigation',
    };
    return (
      <span className={statusClasses[status] || 'status-badge'}>
        {statusLabels[status] || status}
      </span>
    );
  };

  const getRiskBadge = (category: string | null, score: number | null) => {
    if (!category) return <span className="text-muted-foreground text-sm">—</span>;
    return (
      <span className={cn('risk-badge', `risk-${category}`)}>
        {score ?? 0}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Claims Overview</h2>
            <p className="text-muted-foreground">Real-time monitoring and analytics</p>
          </div>
          <Link to="/claims/new">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              New Claim
            </Button>
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Total Claims</p>
                <p className="metric-value">{stats.totalClaims}</p>
                <p className="metric-trend-up flex items-center gap-1 mt-1">
                  <ArrowUpRight className="h-3 w-3" />
                  Active this month
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">Pending Review</p>
                <p className="metric-value">{stats.pendingClaims}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Requires attention
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </Card>

          <Card className="metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="metric-label">High Risk Alerts</p>
                <p className="metric-value text-destructive">{stats.highRiskClaims}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  SIU investigation
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </Card>

          <Card className="metric-card overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="metric-label">Total Exposure</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground truncate" title={formatCurrency(stats.totalAmount)}>
                  {formatCurrency(stats.totalAmount)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Avg Score: {stats.avgRiskScore}%
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Claims & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Claims Table */}
          <Card className="lg:col-span-2 card-enterprise">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg font-semibold">Recent Claims</CardTitle>
              <Link to="/claims">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentClaims.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No claims yet. Create your first claim to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Claim #</th>
                        <th>Claimant</th>
                        <th>Amount</th>
                        <th>Risk</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentClaims.map((claim) => (
                        <tr key={claim.id}>
                          <td>
                            <Link 
                              to={`/claims/${claim.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {claim.claim_number}
                            </Link>
                          </td>
                          <td className="text-foreground">{claim.claimant_name}</td>
                          <td className="font-medium">{formatCurrency(claim.claim_amount)}</td>
                          <td>{getRiskBadge(claim.risk_category, claim.risk_score)}</td>
                          <td>{getStatusBadge(claim.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats / Activity Feed */}
          <Card className="card-enterprise">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Low Risk</span>
                    <span className="text-sm font-medium text-success">
                      {claims.filter(c => c.risk_category === 'low').length}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-success rounded-full transition-all"
                      style={{ 
                        width: `${claims.length ? (claims.filter(c => c.risk_category === 'low').length / claims.length) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Medium Risk</span>
                    <span className="text-sm font-medium text-warning">
                      {claims.filter(c => c.risk_category === 'medium').length}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-warning rounded-full transition-all"
                      style={{ 
                        width: `${claims.length ? (claims.filter(c => c.risk_category === 'medium').length / claims.length) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">High Risk</span>
                    <span className="text-sm font-medium text-destructive">
                      {claims.filter(c => c.risk_category === 'high').length}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-destructive rounded-full transition-all"
                      style={{ 
                        width: `${claims.length ? (claims.filter(c => c.risk_category === 'high').length / claims.length) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium mb-3">Quick Actions</p>
                <div className="space-y-2">
                  <Link to="/claims/new" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      File New Claim (FNOL)
                    </Button>
                  </Link>
                  <Link to="/analytics" className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      View Analytics
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resolution Rate Card */}
        {claims.length > 0 && (
          <Card className="card-enterprise">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-accent" />
                Claim Resolution Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-2xl font-bold text-success">
                    {claims.filter(c => c.status === 'approved' || c.status === 'auto_approved').length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Approved</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-2xl font-bold text-destructive">
                    {claims.filter(c => c.status === 'rejected').length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Rejected</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-2xl font-bold text-warning">
                    {claims.filter(c => c.status === 'pending' || c.status === 'under_review').length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">In Progress</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-2xl font-bold text-primary">
                    {(() => {
                      const resolved = claims.filter(c => ['approved', 'auto_approved', 'rejected'].includes(c.status)).length;
                      return claims.length > 0 ? Math.round((resolved / claims.length) * 100) : 0;
                    })()}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Resolution Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Bulk Actions Widget (Admin only) */}
        <RecentBulkActions />

        {/* Recent Claim Activity Widget */}
        <RecentClaimActivity claims={claims} />

        {/* Activity Heatmap */}
        {claims.length > 0 && <ClaimActivityHeatmap claims={claims} />}
      </div>
    </AppLayout>
  );
}
