import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Claim } from '@/types/claims';
import { useToast } from '@/hooks/use-toast';

interface ClaimExportProps {
  claims: Claim[];
  filename?: string;
}

export function ClaimExport({ claims, filename = 'claims-export' }: ClaimExportProps) {
  const { toast } = useToast();

  const exportToCSV = () => {
    if (claims.length === 0) {
      toast({ title: 'No Data', description: 'No claims to export.', variant: 'destructive' });
      return;
    }

    const headers = [
      'Claim Number', 'Policy Number', 'Claimant Name', 'Claim Type', 'Amount',
      'Incident Date', 'Location', 'Status', 'Risk Score', 'Risk Category',
      'Assigned Group', 'Created At', 'Description'
    ];

    const rows = claims.map(c => [
      c.claim_number,
      c.policy_number,
      c.claimant_name,
      c.claim_type,
      c.claim_amount.toString(),
      c.incident_date,
      c.incident_location,
      c.status,
      c.risk_score.toString(),
      c.risk_category || '',
      c.assigned_group || '',
      new Date(c.created_at).toISOString(),
      (c.description || '').replace(/"/g, '""'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({ title: 'Export Complete', description: `Exported ${claims.length} claims to CSV.` });
  };

  return (
    <Button variant="outline" size="sm" onClick={exportToCSV}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
