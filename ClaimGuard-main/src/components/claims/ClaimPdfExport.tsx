import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { Claim, ClaimStatus, FraudFactor, FraudResult, ClaimEvent } from '@/types/claims';
import { useToast } from '@/hooks/use-toast';

type ClaimNoteExport = {
  id: string;
  note_type: string;
  content: string;
  created_at: string;
  user_id: string;
};

interface ClaimPdfExportProps {
  claim: Claim;
  fraudResult?: FraudResult;
  events?: ClaimEvent[];
  notes?: ClaimNoteExport[];
}

const statusLabels: Record<ClaimStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  auto_approved: 'Auto-Approved',
  rejected: 'Rejected',
  siu_investigation: 'SIU Investigation',
};

const claimTypeLabels: Record<string, string> = {
  auto: 'Auto',
  property: 'Property',
  liability: 'Liability',
  workers_comp: 'Workers Comp',
  health: 'Health',
};

export function ClaimPdfExport({ claim, fraudResult, events, notes }: ClaimPdfExportProps) {
  const { toast } = useToast();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });

  const generatePdf = () => {
    const factors: FraudFactor[] = fraudResult?.factors ?? [];
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Claim Report - ${claim.claim_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; padding: 40px; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 24px; font-weight: 700; }
    .header .meta { text-align: right; color: #666; font-size: 12px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-approved { background: #dcfce7; color: #166534; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-rejected { background: #fecaca; color: #991b1b; }
    .badge-siu { background: #fecaca; color: #991b1b; }
    .badge-review { background: #dbeafe; color: #1e40af; }
    .badge-low { background: #dcfce7; color: #166534; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-high { background: #fecaca; color: #991b1b; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 15px; font-weight: 700; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .field p { font-size: 13px; font-weight: 500; }
    .description { background: #f9fafb; padding: 12px; border-radius: 6px; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 6px 8px; background: #f3f4f6; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
    .risk-meter { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 6px; }
    .risk-fill { height: 100%; border-radius: 4px; }
    .note { background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #6366f1; }
    .note-internal { border-left-color: #f59e0b; }
    .note-meta { font-size: 11px; color: #6b7280; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${claim.claim_number}</h1>
      <span class="badge badge-${claim.status === 'approved' || claim.status === 'auto_approved' ? 'approved' : claim.status === 'rejected' ? 'rejected' : claim.status === 'siu_investigation' ? 'siu' : claim.status === 'under_review' ? 'review' : 'pending'}">
        ${statusLabels[claim.status]}
      </span>
    </div>
    <div class="meta">
      <p>Generated: ${new Date().toLocaleDateString()}</p>
      <p>Claim Type: ${claimTypeLabels[claim.claim_type] || claim.claim_type}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Claim Details</div>
    <div class="grid">
      <div class="field"><label>Policy Number</label><p>${claim.policy_number}</p></div>
      <div class="field"><label>Claim Amount</label><p>${formatCurrency(claim.claim_amount)}</p></div>
      <div class="field"><label>Incident Date</label><p>${formatDate(claim.incident_date)}</p></div>
      <div class="field"><label>Assigned Group</label><p>${claim.assigned_group || 'Unassigned'}</p></div>
      <div class="field"><label>Incident Location</label><p>${claim.incident_location}</p></div>
      <div class="field"><label>Created</label><p>${formatDateTime(claim.created_at)}</p></div>
    </div>
    ${claim.description ? `<div class="description"><label style="font-size:11px;color:#6b7280;">Description</label><p style="margin-top:4px;">${claim.description}</p></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Claimant Information</div>
    <div class="grid">
      <div class="field"><label>Name</label><p>${claim.claimant_name}</p></div>
      <div class="field"><label>Email</label><p>${claim.claimant_email || 'N/A'}</p></div>
      <div class="field"><label>Phone</label><p>${claim.claimant_phone || 'N/A'}</p></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Risk Analysis</div>
    <div class="grid">
      <div class="field">
        <label>Risk Score</label>
        <p style="font-size:20px;font-weight:700;color:${(claim.risk_score || 0) >= 60 ? '#dc2626' : (claim.risk_score || 0) >= 30 ? '#d97706' : '#16a34a'}">${claim.risk_score || 0}%</p>
        <div class="risk-meter">
          <div class="risk-fill" style="width:${claim.risk_score || 0}%;background:${(claim.risk_score || 0) >= 60 ? '#dc2626' : (claim.risk_score || 0) >= 30 ? '#d97706' : '#16a34a'}"></div>
        </div>
      </div>
      <div class="field">
        <label>Risk Category</label>
        <p><span class="badge badge-${claim.risk_category || 'low'}">${(claim.risk_category || 'N/A').toUpperCase()}</span></p>
      </div>
    </div>
    ${factors.length > 0 ? `
    <table style="margin-top:12px;">
      <thead><tr><th>Risk Factor</th><th>Weight</th><th>Description</th></tr></thead>
      <tbody>
        ${factors.map(f => `<tr><td>${f.name}</td><td>${f.weight}%</td><td>${f.description}</td></tr>`).join('')}
      </tbody>
    </table>` : ''}
  </div>

  ${events && events.length > 0 ? `
  <div class="section">
    <div class="section-title">Activity Timeline</div>
    <table>
      <thead><tr><th>Event</th><th>Details</th><th>Date</th></tr></thead>
      <tbody>
        ${events.map(e => {
          const data = e.event_data as Record<string, unknown> || {};
          const detail = e.event_type === 'status_changed' 
            ? `${data.old_status || '?'} → ${data.new_status || '?'}`
            : e.event_type === 'claim_created'
            ? `Risk: ${data.risk_category || 'N/A'}, Score: ${data.fraud_score || 'N/A'}%`
            : JSON.stringify(data);
          return `<tr><td>${e.event_type.replace(/_/g, ' ')}</td><td>${detail}</td><td>${formatDateTime(e.created_at)}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${notes && notes.length > 0 ? `
  <div class="section">
    <div class="section-title">Notes & Comments</div>
    ${notes.map(n => `
      <div class="note ${n.note_type === 'internal' ? 'note-internal' : ''}">
        <div class="note-meta">${n.note_type === 'internal' ? '🔒 Internal Note' : '💬 Comment'} · ${formatDateTime(n.created_at)}</div>
        <p style="margin-top:4px;">${n.content}</p>
      </div>
    `).join('')}
  </div>` : ''}

  <div class="footer">
    Enterprise Claims Orchestration Platform · Confidential · ${claim.claim_number}
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      // Give time for styles to load
      setTimeout(() => {
        printWindow.print();
      }, 250);
      toast({
        title: 'PDF Report Generated',
        description: `Report for ${claim.claim_number} is ready to save.`,
      });
    } else {
      toast({
        title: 'Popup Blocked',
        description: 'Please allow popups to generate PDF reports.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button variant="outline" onClick={generatePdf}>
      <FileDown className="mr-2 h-4 w-4" />
      Export PDF
    </Button>
  );
}