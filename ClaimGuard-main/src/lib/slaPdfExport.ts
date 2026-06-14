import { format } from 'date-fns';

interface SlaSnapshot {
  week_start: string;
  total_emails: number;
  sent_count: number;
  failed_count: number;
  success_rate: number;
  first_attempt_rate: number;
  avg_attempts: number;
  sla_healthy: boolean;
}

interface SlaThresholds {
  first_attempt_rate_target: number;
  max_hourly_failure_rate: number;
  escalation_consecutive_weeks: number;
}

export function generateSlaPdf(snapshots: SlaSnapshot[], thresholds: SlaThresholds) {
  const sorted = [...snapshots].sort((a, b) => b.week_start.localeCompare(a.week_start));
  const latest = sorted[0];
  const reportDate = format(new Date(), 'MMMM d, yyyy');

  let consecutiveDegraded = 0;
  for (const s of sorted) {
    if (!s.sla_healthy) consecutiveDegraded++;
    else break;
  }

  const totalEmails = sorted.reduce((sum, s) => sum + s.total_emails, 0);
  const totalSent = sorted.reduce((sum, s) => sum + s.sent_count, 0);
  const totalFailed = sorted.reduce((sum, s) => sum + s.failed_count, 0);
  const avgSuccess = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + r.success_rate, 0) / sorted.length) : 0;
  const avgFirstAttempt = sorted.length > 0 ? Math.round(sorted.reduce((s, r) => s + r.first_attempt_rate, 0) / sorted.length) : 0;

  const statusEmoji = latest?.sla_healthy ? '✅' : '⚠️';

  const tableRows = sorted.map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${format(new Date(s.week_start), 'MMM d, yyyy')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${s.total_emails}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#16a34a;">${s.sent_count}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#dc2626;">${s.failed_count}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${s.success_rate}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${s.first_attempt_rate}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${s.avg_attempts}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;">
        <span style="padding:2px 8px;border-radius:9999px;font-weight:600;${s.sla_healthy ? 'background:#dcfce7;color:#16a34a;' : 'background:#fee2e2;color:#dc2626;'}">${s.sla_healthy ? 'Healthy' : 'Degraded'}</span>
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SLA Report - ${reportDate}</title>
      <style>
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 40px; color: #1a1a2e; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #1a1a2e; }
        .brand { font-size: 24px; font-weight: 800; color: #1a1a2e; }
        .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
        .kpi { padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .kpi-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi-value { font-size: 28px; font-weight: 800; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { padding: 10px 12px; background: #f3f4f6; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">🛡️ ClaimGuard</div>
          <div class="subtitle">Email Delivery SLA Report</div>
          <div class="subtitle">Generated: ${reportDate}</div>
        </div>
        <div>
          <span class="badge" style="${latest?.sla_healthy ? 'background:#dcfce7;color:#16a34a;' : 'background:#fee2e2;color:#dc2626;'}">
            ${statusEmoji} ${latest?.sla_healthy ? 'SLA Healthy' : 'SLA Degraded'}
          </span>
        </div>
      </div>

      ${consecutiveDegraded >= thresholds.escalation_consecutive_weeks ? `
        <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin-bottom:24px;">
          <strong style="color:#dc2626;">🚨 Escalation Alert:</strong>
          <span style="color:#991b1b;"> SLA has been degraded for ${consecutiveDegraded} consecutive weeks (threshold: ${thresholds.escalation_consecutive_weeks}).</span>
        </div>
      ` : ''}

      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">Total Emails</div>
          <div class="kpi-value">${totalEmails.toLocaleString()}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Overall Success</div>
          <div class="kpi-value" style="color:#16a34a;">${avgSuccess}%</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Avg First-Attempt</div>
          <div class="kpi-value" style="color:${avgFirstAttempt >= thresholds.first_attempt_rate_target ? '#16a34a' : '#dc2626'};">${avgFirstAttempt}%</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Failed Emails</div>
          <div class="kpi-value" style="color:#dc2626;">${totalFailed}</div>
        </div>
      </div>

      <div>
        <div class="section-title">📊 Weekly Performance</div>
        <div class="subtitle" style="margin-bottom:12px;">Targets: First-attempt ≥${thresholds.first_attempt_rate_target}% · Max failure ≤${thresholds.max_hourly_failure_rate}% · Escalation after ${thresholds.escalation_consecutive_weeks} degraded weeks</div>
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th style="text-align:right;">Total</th>
              <th style="text-align:right;">Sent</th>
              <th style="text-align:right;">Failed</th>
              <th style="text-align:right;">Success</th>
              <th style="text-align:right;">1st Attempt</th>
              <th style="text-align:right;">Avg Tries</th>
              <th style="text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <div class="footer">
        ClaimGuard Enterprise Claims Orchestration Platform · Confidential · ${reportDate}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}
