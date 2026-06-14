import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GitCompareArrows, X } from 'lucide-react';
import { Claim } from '@/types/claims';
import { cn } from '@/lib/utils';

interface ClaimCompareProps {
  claims: Claim[];
}

export function ClaimCompare({ claims }: ClaimCompareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [claimA, setClaimA] = useState<string>('');
  const [claimB, setClaimB] = useState<string>('');

  const a = claims.find(c => c.id === claimA);
  const b = claims.find(c => c.id === claimB);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const CompareRow = ({ label, valA, valB, highlight }: { label: string; valA: string; valB: string; highlight?: boolean }) => {
    const diff = valA !== valB;
    return (
      <div className={cn('grid grid-cols-3 gap-2 py-2 px-3 rounded text-sm', diff && highlight && 'bg-warning/5')}>
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className={cn(diff && 'font-semibold')}>{valA}</span>
        <span className={cn(diff && 'font-semibold')}>{valB}</span>
      </div>
    );
  };

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <GitCompareArrows className="mr-2 h-4 w-4" />
        Compare Claims
      </Button>
    );
  }

  return (
    <Card className="card-enterprise">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompareArrows className="h-5 w-5 text-accent" />
          Claim Comparison
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select value={claimA} onValueChange={setClaimA}>
            <SelectTrigger>
              <SelectValue placeholder="Select Claim A" />
            </SelectTrigger>
            <SelectContent>
              {claims.map(c => (
                <SelectItem key={c.id} value={c.id} disabled={c.id === claimB}>
                  {c.claim_number} - {c.claimant_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={claimB} onValueChange={setClaimB}>
            <SelectTrigger>
              <SelectValue placeholder="Select Claim B" />
            </SelectTrigger>
            <SelectContent>
              {claims.map(c => (
                <SelectItem key={c.id} value={c.id} disabled={c.id === claimA}>
                  {c.claim_number} - {c.claimant_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {a && b && (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
              <span>Field</span>
              <span>{a.claim_number}</span>
              <span>{b.claim_number}</span>
            </div>
            <CompareRow label="Claimant" valA={a.claimant_name} valB={b.claimant_name} />
            <CompareRow label="Type" valA={a.claim_type} valB={b.claim_type} highlight />
            <CompareRow label="Amount" valA={formatCurrency(a.claim_amount)} valB={formatCurrency(b.claim_amount)} highlight />
            <CompareRow label="Risk Score" valA={`${a.risk_score}%`} valB={`${b.risk_score}%`} highlight />
            <CompareRow label="Risk Category" valA={a.risk_category || '-'} valB={b.risk_category || '-'} highlight />
            <CompareRow label="Status" valA={a.status} valB={b.status} highlight />
            <CompareRow label="Assigned" valA={a.assigned_group || '-'} valB={b.assigned_group || '-'} />
            <CompareRow label="Location" valA={a.incident_location} valB={b.incident_location} />
            <CompareRow label="Incident Date" valA={a.incident_date} valB={b.incident_date} highlight />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
