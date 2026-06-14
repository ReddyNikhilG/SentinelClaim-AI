import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('re_CCEJgzDJ_5SgTxtMyuLA52FdBsCh2fJYM');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetFrequency: string | null = body.frequency ?? null;
    const isTest: boolean = body.test === true;

    // Get digest subscribers
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, email_digest_frequency')
      .eq('email_digest_enabled', true);

    if (prefsError) throw prefsError;
    if (!prefs?.length) {
      return jsonResponse({ message: 'No digest subscribers' });
    }

    const filtered = targetFrequency
      ? prefs.filter(p => p.email_digest_frequency === targetFrequency)
      : prefs;

    if (!filtered.length) {
      return jsonResponse({ message: 'No matching subscribers' });
    }

    // Fetch recent claims
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentClaims } = await supabase
      .from('claims')
      .select('id, claim_number, claimant_name, status, risk_category, claim_amount, created_at, updated_at')
      .gte('updated_at', weekAgo)
      .order('updated_at', { ascending: false })
      .limit(20);

    // Get profiles
    const userIds = filtered.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);

    let sent = 0;
    let failed = 0;

    for (const pref of filtered) {
      const profile = profileMap.get(pref.user_id);
      if (!profile?.email) continue;

      const period = pref.email_digest_frequency === 'weekly' ? 'Weekly' : 'Daily';
      const since = pref.email_digest_frequency === 'weekly' ? weekAgo : dayAgo;
      const periodClaims = recentClaims?.filter(c => c.updated_at >= since) ?? [];
      const periodStats = computeStats(periodClaims);

      const subject = `ClaimGuard ${period} Digest — ${periodStats.total} claim${periodStats.total !== 1 ? 's' : ''} updated`;
      const html = buildDigestHtml(profile, period, periodClaims, periodStats);

      // Send with retry (up to 3 attempts, exponential backoff)
      let success = false;
      let errorText: string | null = null;
      let attempts = 0;
      const MAX_RETRIES = 3;

      while (attempts < MAX_RETRIES) {
        attempts++;
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'ClaimGuard <notifications@claimguard.app>',
            to: [profile.email],
            subject,
            html,
          }),
        });

        if (emailRes.ok) {
          success = true;
          errorText = null;
          break;
        }

        errorText = await emailRes.text();
        // Don't retry 4xx client errors (invalid email, auth, etc.)
        if (emailRes.status >= 400 && emailRes.status < 500) break;

        // Exponential backoff: 1s, 2s, 4s
        if (attempts < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempts - 1) * 1000));
        }
      }

      // Log the email
      await supabase.from('email_log').insert({
        user_id: pref.user_id,
        email_type: isTest ? 'digest_test' : 'digest',
        recipient_email: profile.email,
        subject,
        status: success ? 'sent' : 'failed',
        error_message: errorText,
        metadata: { frequency: pref.email_digest_frequency, claims_count: periodStats.total, attempts },
      });

      if (success) {
        sent++;
      } else {
        console.error(`Failed to send digest to ${profile.email} after ${attempts} attempts:`, errorText);
        failed++;
      }
    }

    return jsonResponse({ message: 'Digest sent', sent, failed });
  } catch (err) {
    console.error('Digest error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function jsonResponse(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function computeStats(claims: any[]) {
  return {
    total: claims.length,
    approved: claims.filter(c => c.status === 'approved' || c.status === 'auto_approved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
    pending: claims.filter(c => c.status === 'pending').length,
    high_risk: claims.filter(c => c.risk_category === 'high').length,
    siu: claims.filter(c => c.status === 'siu_investigation').length,
  };
}

function statusColor(status: string): string {
  switch (status) {
    case 'approved': case 'auto_approved': return '#16a34a';
    case 'rejected': return '#dc2626';
    case 'pending': return '#d97706';
    case 'siu_investigation': return '#0284c7';
    case 'under_review': return '#7c3aed';
    default: return '#6b7280';
  }
}

function statBox(label: string, value: number, color: string): string {
  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:24px;font-weight:700;color:${color};">${value}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:4px;">${label}</div>
  </div>`;
}

function buildDigestHtml(profile: any, period: string, periodClaims: any[], stats: any): string {
  const recentRows = periodClaims.slice(0, 5).map(c => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${c.claim_number}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151;">${c.claimant_name}</td>
      <td style="padding:8px 12px;font-size:13px;">
        <span style="background:${statusColor(c.status)};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">
          ${c.status.replace(/_/g, ' ')}
        </span>
      </td>
      <td style="padding:8px 12px;font-size:13px;color:#374151;">$${Number(c.claim_amount).toLocaleString()}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,system-ui,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:#0f172a;padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🛡 ClaimGuard</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">${period} Activity Digest</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 24px;">Hi ${profile.full_name || profile.email},</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Here's your ${period.toLowerCase()} summary of claim activity on ClaimGuard.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px;">
        ${statBox('Total Activity', stats.total, '#0f172a')}
        ${statBox('Approved', stats.approved, '#16a34a')}
        ${statBox('Rejected', stats.rejected, '#dc2626')}
        ${statBox('Pending', stats.pending, '#d97706')}
        ${statBox('High Risk', stats.high_risk, '#7c3aed')}
        ${statBox('SIU Escalated', stats.siu, '#0284c7')}
      </div>
      ${periodClaims.length > 0 ? `
      <h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">Recent Claim Activity</h3>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Claim #</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Claimant</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Status</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Amount</th>
        </tr></thead>
        <tbody>${recentRows}</tbody>
      </table>` : `<p style="color:#9ca3af;font-size:14px;text-align:center;padding:20px;">No claim activity in this period.</p>`}
      <div style="margin-top:28px;text-align:center;">
        <a href="https://claimguard.app/claims" style="background:#0f172a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View All Claims →</a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you opted into ${period.toLowerCase()} digests.<br>Manage your preferences in ClaimGuard → Settings → Notification Preferences.</p>
    </div>
  </div>
</body></html>`;
}
