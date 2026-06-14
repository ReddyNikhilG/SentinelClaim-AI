import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useClaim, useClaimFraudResult, useClaimEvents, useClaims } from '@/hooks/useClaims';
import { ClaimDocuments } from '@/components/claims/ClaimDocuments';
import { EditClaimDialog } from '@/components/claims/EditClaimDialog';
import { ClaimNotes } from '@/components/claims/ClaimNotes';
import { ClaimTimeline } from '@/components/claims/ClaimTimeline';
import { ClaimPdfExport } from '@/components/claims/ClaimPdfExport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  FileText, 
  User, 
  MapPin, 
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Activity,
  TrendingUp,
  Phone,
  Mail,
  RefreshCw,
  Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClaimStatus, Claim } from '@/types/claims';

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: claim, isLoading: claimLoading, refetch: refetchClaim } = useClaim(id!);
  const { data: fraudResult, isLoading: fraudLoading } = useClaimFraudResult(id!);
  const { data: events, isLoading: eventsLoading } = useClaimEvents(id!);
  const { updateClaim, isUpdating } = useClaims();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: notes } = useQuery({
    queryKey: ['claim_notes', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claim_notes')
        .select('*')
        .eq('claim_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: ClaimStatus) => {
    const config: Record<ClaimStatus, { label: string; className: string; icon: React.ReactNode }> = {
      pending: { label: 'Pending', className: 'status-badge status-pending', icon: <Clock className="h-3 w-3" /> },
      under_review: { label: 'Under Review', className: 'status-badge status-under-review', icon: <RefreshCw className="h-3 w-3" /> },
      approved: { label: 'Approved', className: 'status-badge status-approved', icon: <CheckCircle2 className="h-3 w-3" /> },
      auto_approved: { label: 'Auto-Approved', className: 'status-badge status-approved', icon: <CheckCircle2 className="h-3 w-3" /> },
      rejected: { label: 'Rejected', className: 'status-badge status-rejected', icon: <AlertTriangle className="h-3 w-3" /> },
      siu_investigation: { label: 'SIU Investigation', className: 'status-badge status-siu', icon: <Shield className="h-3 w-3" /> },
    };
    const { label, className, icon } = config[status];
    return (
      <span className={cn(className, 'flex items-center gap-1.5')}>
        {icon}
        {label}
      </span>
    );
  };

  const handleStatusChange = (newStatus: string) => {
    if (claim) {
      updateClaim({
        claimId: claim.id,
        updates: { status: newStatus as ClaimStatus },
      });
    }
  };

  const handleEditSave = (updates: Partial<Claim>) => {
    if (claim) {
      updateClaim(
        {
          claimId: claim.id,
          updates,
        },
        {
          onSuccess: () => {
            setEditDialogOpen(false);
            refetchClaim();
          },
        }
      );
    }
  };

  if (claimLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!claim) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Claim Not Found</h2>
          <p className="text-muted-foreground mb-4">The claim you're looking for doesn't exist.</p>
          <Link to="/claims">
            <Button>Back to Claims</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const factors = fraudResult?.factors as { name: string; weight: number; description: string }[] || [];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">{claim.claim_number}</h2>
                {getStatusBadge(claim.status)}
              </div>
              <p className="text-muted-foreground">
                Created {formatDateTime(claim.created_at)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClaimPdfExport
              claim={claim}
              fraudResult={fraudResult}
              events={events}
              notes={notes}
            />
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(true)}
              disabled={isUpdating}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Select
              value={claim.status}
              onValueChange={handleStatusChange}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-40 sm:w-48">
                <SelectValue placeholder="Change Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="siu_investigation">SIU Investigation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Claim Details */}
            <Card className="card-enterprise">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  Claim Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Policy Number</p>
                    <p className="font-medium">{claim.policy_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Claim Type</p>
                    <p className="font-medium capitalize">{claim.claim_type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Claim Amount</p>
                    <p className="font-medium text-lg">{formatCurrency(claim.claim_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned Group</p>
                    <p className="font-medium">{claim.assigned_group || 'Unassigned'}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Incident Date</p>
                  </div>
                  <p className="font-medium">{formatDate(claim.incident_date)}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Incident Location</p>
                  </div>
                  <p className="font-medium">{claim.incident_location}</p>
                </div>

                {claim.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Description</p>
                    <p className="text-foreground bg-muted/50 p-3 rounded-lg">
                      {claim.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Claimant Information */}
            <Card className="card-enterprise">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-accent" />
                  Claimant Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="font-semibold text-lg">{claim.claimant_name}</p>
                    {claim.claimant_email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{claim.claimant_email}</span>
                      </div>
                    )}
                    {claim.claimant_phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{claim.claimant_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <ClaimTimeline
              events={events}
              isLoading={eventsLoading}
              claimCreatedAt={claim.created_at}
            />

            {/* Notes & Comments */}
            <ClaimNotes claimId={claim.id} />

            {/* Documents & Evidence */}
            <ClaimDocuments claimId={claim.id} />
          </div>

          {/* Sidebar - Risk Analysis */}
          <div className="space-y-6">
            {/* Risk Score Card */}
            <Card className={cn(
              'card-enterprise border-l-4',
              claim.risk_category === 'high' && 'border-l-destructive',
              claim.risk_category === 'medium' && 'border-l-warning',
              claim.risk_category === 'low' && 'border-l-success'
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-accent" />
                  Risk Analysis
                </CardTitle>
                <CardDescription>
                  AI-powered fraud detection score
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className={cn(
                    'text-5xl font-bold mb-2',
                    claim.risk_category === 'high' && 'text-destructive',
                    claim.risk_category === 'medium' && 'text-warning',
                    claim.risk_category === 'low' && 'text-success'
                  )}>
                    {claim.risk_score}
                  </div>
                  <p className="text-sm text-muted-foreground">Risk Score (0-100)</p>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'mt-2',
                      `risk-${claim.risk_category}`
                    )}
                  >
                    {claim.risk_category?.toUpperCase()} RISK
                  </Badge>
                </div>

                {/* Score Gauge */}
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        claim.risk_category === 'high' && 'bg-destructive',
                        claim.risk_category === 'medium' && 'bg-warning',
                        claim.risk_category === 'low' && 'bg-success'
                      )}
                      style={{ width: `${claim.risk_score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Factors */}
            {factors.length > 0 && (
              <Card className="card-enterprise">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-accent" />
                    Risk Factors
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {factors.map((factor, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{factor.name}</span>
                        <Badge variant="outline" className="text-xs">
                          +{factor.weight}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{factor.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Routing Info */}
            <Card className="card-enterprise">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Claim Routing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Assigned To</span>
                    <span className="font-medium">{claim.assigned_group || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="font-medium">{formatDateTime(claim.updated_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Dialog */}
        <EditClaimDialog
          claim={claim}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSave={handleEditSave}
          isSaving={isUpdating}
        />
      </div>
    </AppLayout>
  );
}
