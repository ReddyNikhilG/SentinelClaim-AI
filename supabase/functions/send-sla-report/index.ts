import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get SLA thresholds
    const { data: thresholds } = await supabase
      .from('sla_thresholds')
      .select('*')
      .limit(1)
      .maybeSingle();

    const firstAttemptTarget = thresholds?.first_attempt_rate_target ?? 80;
    const maxFailureRate = thresholds?.max_hourly_failure_rate ?? 20;
    const escalationWeeks = thresholds?.escalation_consecutive_weeks ?? 2;

    // Get emails from last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: weekLogs, error: logError } = await supabase
      .from('email_log')
      .select('id, status, metadata, created_at')
      .gte('created_at', oneWeekAgo);

    if (logError) throw logError;

    const total = weekLogs?.length ?? 0;
    const sent = weekLogs?.filter((l: any) => l.status === 'sent').length ?? 0;
    const failed = weekLogs?.filter((l: any) => l.status === 'failed').length ?? 0;
    const successRate = total > 0 ? Math.round((sent / total) * 100) : 100;

    // First-attempt delivery
    const sentLogs = weekLogs?.filter((l: any) => l.status === 'sent') ?? [];
    const attemptCounts = sentLogs.map((l: any) => Number(l.metadata?.attempts) || 1);
    const firstAttemptCount = attemptCounts.filter((a: number) => a === 1).length;
    const firstAttemptRate = sentLogs.length > 0 ? Math.round((firstAttemptCount / sentLogs.length) * 100) : 100;
    const avgAttempts = attemptCounts.length > 0
      ? Math.round((attemptCounts.reduce((a: number, b: number) => a + b, 0) / attemptCounts.length) * 100) / 100
      : 1;

    const slaHealthy = firstAttemptRate >= firstAttemptTarget && (total > 0 ? Math.round((failed / total) * 100) <= maxFailureRate : true);

    // Build report message
    const statusEmoji = slaHealthy ? '✅' : '⚠️';
    const message = [
      `${statusEmoji} Weekly Email Delivery SLA Report`,
      ``,
      `📊 Summary (last 7 days):`,
      `• Total emails: ${total}`,
      `• Delivered: ${sent} | Failed: ${failed}`,
      `• Success rate: ${successRate}%`,
      ``,
      `🎯 SLA Metrics:`,
      `• First-attempt delivery: ${firstAttemptRate}% (target: ≥${firstAttemptTarget}%)`,
      `• Avg attempts per email: ${avgAttempts}`,
      `• Overall status: ${slaHealthy ? 'Healthy' : 'Degraded — action needed'}`,
    ].join('\n');

    // Get all admins
    const { data: admins, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError) throw rolesError;
    if (!admins?.length) {
      return jsonResponse({ message: 'No admins to notify' });
    }

    const notifications = admins.map((r: any) => ({
      user_id: r.user_id,
      title: `${statusEmoji} Weekly SLA Report`,
      message,
      type: slaHealthy ? 'info' : 'warning',
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) throw insertError;

    // Save SLA snapshot
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await supabase.from('sla_snapshots').insert({
      week_start: weekStart,
      total_emails: total,
      sent_count: sent,
      failed_count: failed,
      success_rate: successRate,
      first_attempt_rate: firstAttemptRate,
      avg_attempts: avgAttempts,
      sla_healthy: slaHealthy,
    });

    // Check for consecutive degraded weeks and escalate
    const { data: recentSnapshots } = await supabase
      .from('sla_snapshots')
      .select('sla_healthy, week_start')
      .order('week_start', { ascending: false })
      .limit(5);

    let consecutiveDegraded = 0;
    for (const snap of recentSnapshots ?? []) {
      if (!snap.sla_healthy) consecutiveDegraded++;
      else break;
    }

    if (consecutiveDegraded >= escalationWeeks) {
      const escalation = admins.map((r: any) => ({
        user_id: r.user_id,
        title: `🚨 SLA Escalation: ${consecutiveDegraded} Consecutive Degraded Weeks`,
        message: `Email delivery SLA has been degraded for ${consecutiveDegraded} consecutive weeks. Immediate action required.\n\nLatest: Success ${successRate}% · First-attempt ${firstAttemptRate}%`,
        type: 'warning',
      }));
      await supabase.from('notifications').insert(escalation);
    }

    // Send email via Resend to all admins
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && admins.length > 0) {
      const adminIds = admins.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .in('user_id', adminIds);

      const emails = profiles?.map((p: any) => p.email).filter(Boolean) ?? [];
      if (emails.length > 0) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'SLA Reports <onboarding@resend.dev>',
              to: emails,
              subject: `${statusEmoji} Weekly Email Delivery SLA Report`,
              text: message,
            }),
          });
        } catch (emailErr) {
          console.error('Resend email error:', emailErr);
        }
      }
    }

    // Send Slack notification for escalation
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SLACK_API_KEY = Deno.env.get('SLACK_API_KEY');
    if (LOVABLE_API_KEY && SLACK_API_KEY && consecutiveDegraded >= escalationWeeks) {
      try {
        const SLACK_CHANNEL = thresholds?.slack_channel || '#general';
        const slackMessage = [
          `🚨 *SLA Escalation Alert*`,
          `Email delivery SLA degraded for *${consecutiveDegraded} consecutive weeks*.`,
          `• Success Rate: ${successRate}%`,
          `• First-Attempt: ${firstAttemptRate}%`,
          `• Failed: ${failed}/${total} emails`,
          `Immediate action required.`,
        ].join('\n');

        await fetch('https://connector-gateway.lovable.dev/slack/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': SLACK_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: SLACK_CHANNEL,
            text: slackMessage,
            username: 'ClaimGuard SLA Monitor',
            icon_emoji: ':rotating_light:',
          }),
        });
      } catch (slackErr) {
        console.error('Slack notification error:', slackErr);
      }
    }

    return jsonResponse({
      message: 'Weekly SLA report sent',
      adminsNotified: admins.length,
      slaHealthy,
      successRate,
      firstAttemptRate,
      total,
      consecutiveDegraded,
    });
  } catch (err) {
    console.error('SLA report error:', err);
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
