import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useClaims } from '@/hooks/useClaims';
import { useRealtimeClaims } from '@/hooks/useRealtimeClaims';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  PlusCircle, 
  FileText,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  CheckSquare,
  XSquare,
  AlertTriangle,
  CalendarIcon,
  X,
  UserCheck,
  Timer
} from 'lucide-react';
import { ClaimExport } from '@/components/claims/ClaimExport';
import { ClaimCompare } from '@/components/claims/ClaimCompare';
import { BulkReassignDialog } from '@/components/claims/BulkReassignDialog';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ClaimStatus, RiskCategory } from '@/types/claims';
import { useAuth } from '@/contexts/AuthContext';

export default function ClaimsListPage() {
  useRealtimeClaims();
  const { claims, isLoading, updateClaim, isUpdating } = useClaims();
  const { userRole, user } = useAuth();
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateField, setDateField] = useState<string>('incident_date');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const ITEMS_PER_PAGE = 10;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedClaims.length && paginatedClaims.every(c => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedClaims.map(c => c.id)));
    }
  };

  const handleBulkStatusUpdate = async (newStatus: ClaimStatus) => {
    setBulkUpdating(true);
    const claimIds = Array.from(selectedIds);
    const promises = claimIds.map(claimId =>
      new Promise<void>((resolve) => {
        updateClaim(
          { claimId, updates: { status: newStatus } },
          { onSettled: () => resolve() }
        );
      })
    );
    await Promise.all(promises);

    // Log bulk action event
    const affectedClaims = claims.filter(c => claimIds.includes(c.id));
    const actionName = `bulk_${newStatus}`;
    const affectedClaimNumbers = affectedClaims.map(c => c.claim_number);

    await supabase.from('claim_events').insert({
      claim_id: claimIds[0],
      event_type: 'bulk_action',
      event_data: {
        action: actionName,
        affected_claim_ids: claimIds,
        affected_claim_numbers: affectedClaimNumbers,
        count: claimIds.length,
      },
      performed_by: user?.id,
    });

    // Send email notifications to adjusters/admins
    supabase.functions.invoke('notify-bulk-action', {
      body: {
        action: actionName,
        affected_claim_numbers: affectedClaimNumbers,
        count: claimIds.length,
        performed_by_name: user?.user_metadata?.full_name || user?.email || 'Unknown',
      },
    }).catch(err => console.error('Bulk action notification failed:', err));

    setSelectedIds(new Set());
    setBulkUpdating(false);
  };

  const filteredClaims = claims.filter(claim => {
    const matchesSearch = 
      claim.claim_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.claimant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.policy_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    const matchesRisk = riskFilter === 'all' || claim.risk_category === riskFilter;

    const dateValue = new Date(dateField === 'incident_date' ? claim.incident_date : claim.created_at);
    const matchesDateFrom = !dateFrom || dateValue >= dateFrom;
    const matchesDateTo = !dateTo || dateValue <= new Date(dateTo.getTime() + 86400000 - 1);

    return matchesSearch && matchesStatus && matchesRisk && matchesDateFrom && matchesDateTo;
  });

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedClaims = filteredClaims.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: ClaimStatus) => {
    const statusClasses: Record<ClaimStatus, string> = {
      pending: 'status-badge status-pending',
      under_review: 'status-badge status-under-review',
      approved: 'status-badge status-approved',
      auto_approved: 'status-badge status-approved',
      rejected: 'status-badge status-rejected',
      siu_investigation: 'status-badge status-siu',
    };
    const statusLabels: Record<ClaimStatus, string> = {
      pending: 'Pending',
      under_review: 'Under Review',
      approved: 'Approved',
      auto_approved: 'Auto-Approved',
      rejected: 'Rejected',
      siu_investigation: 'SIU Investigation',
    };
    return (
      <span className={statusClasses[status]}>
        {statusLabels[status]}
      </span>
    );
  };

  const getRiskBadge = (category: RiskCategory | null, score: number) => {
    if (!category) return <span className="text-muted-foreground text-sm">-</span>;
    return (
      <span className={cn('risk-badge', `risk-${category}`)}>
        {score}% {category}
      </span>
    );
  };

  const getClaimTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      auto: 'Auto',
      property: 'Property',
      liability: 'Liability',
      workers_comp: 'Workers Comp',
      health: 'Health',
    };
    return labels[type] || type;
  };

  const getClaimAge = (createdAt: string) => {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
    const color = days <= 7 ? 'text-success bg-success/10' : days <= 30 ? 'text-warning bg-warning/10' : 'text-destructive bg-destructive/10';
    const label = days === 0 ? 'Today' : days === 1 ? '1d' : `${days}d`;
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full', color)}>
        <Timer className="h-3 w-3" />
        {label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">All Claims</h2>
            <p className="text-muted-foreground">
              {filteredClaims.length} claim{filteredClaims.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ClaimExport claims={filteredClaims} />
            <Link to="/claims/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Claim
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card className="card-enterprise">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by claim #, claimant, or policy..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="auto_approved">Auto-Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="siu_investigation">SIU Investigation</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    <SelectItem value="low">Low Risk</SelectItem>
                    <SelectItem value="medium">Medium Risk</SelectItem>
                    <SelectItem value="high">High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Date Range Filter */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border mt-2">
              <Select value={dateField} onValueChange={setDateField}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incident_date">Incident Date</SelectItem>
                  <SelectItem value="created_at">Created Date</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => { setDateFrom(d); setCurrentPage(1); }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => { setDateTo(d); setCurrentPage(1); }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDateFrom(undefined); setDateTo(undefined); setCurrentPage(1); }}
                  className="h-10"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear dates
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Claim Comparison Tool */}
        {claims.length >= 2 && <ClaimCompare claims={claims} />}

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.size} claim{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  disabled={bulkUpdating}
                  onClick={() => handleBulkStatusUpdate('approved')}
                >
                  <CheckSquare className="mr-1 h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                  disabled={bulkUpdating}
                  onClick={() => handleBulkStatusUpdate('rejected')}
                >
                  <XSquare className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  disabled={bulkUpdating}
                  onClick={() => handleBulkStatusUpdate('siu_investigation')}
                >
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                  Escalate to SIU
                </Button>
                {userRole === 'admin' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-primary border-primary/30 hover:bg-primary/5"
                    disabled={bulkUpdating}
                    onClick={() => setShowReassignDialog(true)}
                  >
                    <UserCheck className="mr-1 h-3.5 w-3.5" />
                    Reassign
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkUpdating}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Claims Table */}
        <Card className="card-enterprise">
          <CardContent className="p-0">
            {filteredClaims.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No claims found</h3>
                <p className="text-muted-foreground mb-4">
                  {claims.length === 0 
                    ? "Create your first claim to get started"
                    : "Try adjusting your search or filters"}
                </p>
                {claims.length === 0 && (
                  <Link to="/claims/new">
                    <Button>Create First Claim</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <Checkbox
                          checked={paginatedClaims.length > 0 && paginatedClaims.every(c => selectedIds.has(c.id))}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th>Claim #</th>
                      <th>Claimant</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Incident Date</th>
                      <th>Risk Score</th>
                      <th>Age</th>
                      <th>Status</th>
                      <th>Assigned To</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClaims.map((claim) => (
                      <tr key={claim.id} className={cn("group", selectedIds.has(claim.id) && "bg-primary/5")}>
                        <td>
                          <Checkbox
                            checked={selectedIds.has(claim.id)}
                            onCheckedChange={() => toggleSelect(claim.id)}
                          />
                        </td>
                        <td>
                          <Link 
                            to={`/claims/${claim.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {claim.claim_number}
                          </Link>
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-foreground">{claim.claimant_name}</p>
                            <p className="text-xs text-muted-foreground">{claim.policy_number}</p>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm">{getClaimTypeLabel(claim.claim_type)}</span>
                        </td>
                        <td className="font-medium">{formatCurrency(claim.claim_amount)}</td>
                        <td className="text-sm text-muted-foreground">
                          {formatDate(claim.incident_date)}
                        </td>
                        <td>{getRiskBadge(claim.risk_category, claim.risk_score)}</td>
                        <td>{getClaimAge(claim.created_at)}</td>
                        <td>{getStatusBadge(claim.status)}</td>
                        <td className="text-sm text-muted-foreground">
                          {claim.assigned_group || '-'}
                        </td>
                        <td>
                          <Link to={`/claims/${claim.id}`}>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {filteredClaims.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filteredClaims.length)} of {filteredClaims.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={page === safePage ? 'default' : 'outline'}
                      size="sm"
                      className="w-9"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {userRole === 'admin' && (
        <BulkReassignDialog
          open={showReassignDialog}
          onOpenChange={setShowReassignDialog}
          selectedIds={selectedIds}
          onComplete={() => setSelectedIds(new Set())}
        />
      )}
    </AppLayout>
  );
}
