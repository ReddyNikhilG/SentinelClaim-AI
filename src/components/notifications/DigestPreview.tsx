import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function statBox(label: string, value: number, color: string): string {
  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:24px;font-weight:700;color:${color};">${value}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:4px;">${label}</div>
  </div>`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'approved': return '#16a34a';
    case 'rejected': return '#dc2626';
    case 'pending': return '#d97706';
    default: return '#6b7280';
  }
}

const SAMPLE_CLAIMS = [
  { claim_number: 'CLM-001234', claimant_name: 'Jane Smith', status: 'approved', claim_amount: 15000 },
  { claim_number: 'CLM-005678', claimant_name: 'Robert Chen', status: 'pending', claim_amount: 42500 },
  { claim_number: 'CLM-009012', claimant_name: 'Maria Garcia', status: 'rejected', claim_amount: 8750 },
];

interface DigestPreviewProps {
  frequency: string;
}

export function DigestPreview({ frequency }: DigestPreviewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuth();
  const period = frequency === 'weekly' ? 'Weekly' : 'Daily';
  const name = user?.email ?? 'User';

  const rows = SAMPLE_CLAIMS.map(c => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${c.claim_number}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${c.claimant_name}</td>
      <td style="padding:8px 12px;font-size:13px;">
        <span style="background:${statusColor(c.status)};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">${c.status}</span>
      </td>
      <td style="padding:8px 12px;font-size:13px;color:#374151;">$${c.claim_amount.toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
      <div style="background:#0f172a;padding:28px 32px;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🛡 ClaimGuard</h1>
        <p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">${period} Activity Digest</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#374151;font-size:15px;margin:0 0 24px;">Hi ${name},</p>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Here's your ${period.toLowerCase()} summary of claim activity on ClaimGuard.</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
          ${statBox('Total Activity', 3, '#0f172a')}
          ${statBox('Approved', 1, '#16a34a')}
          ${statBox('Rejected', 1, '#dc2626')}
          ${statBox('Pending', 1, '#d97706')}
          ${statBox('High Risk', 0, '#7c3aed')}
          ${statBox('SIU Escalated', 0, '#0284c7')}
        </div>
        <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">Recent Claim Activity</h3>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Claim #</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Claimant</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Status</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:28px;text-align:center;">
          <a style="background:#0f172a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View All Claims →</a>
        </div>
      </div>
      <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">This is a preview — no email was sent.<br>Manage your preferences in ClaimGuard → Settings → Notification Preferences.</p>
      </div>
    </div>
  `;

  return (
    <Card className="card-enterprise">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Email Preview</CardTitle>
            <CardDescription className="text-xs">
              See what your {period.toLowerCase()} digest will look like
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(!isVisible)}
            className="gap-2"
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isVisible ? 'Hide' : 'Preview'}
          </Button>
        </div>
      </CardHeader>
      {isVisible && (
        <CardContent className="pt-0">
          <div
            className="rounded-lg border border-border overflow-hidden bg-[#f9fafb]"
            style={{ maxHeight: 500, overflowY: 'auto' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </CardContent>
      )}
    </Card>
  );
}
