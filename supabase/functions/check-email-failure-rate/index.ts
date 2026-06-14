import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Default threshold, overridden by sla_thresholds table
let FAILURE_THRESHOLD = 20;
let MIN_SAMPLES = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load configurable thresholds
    const { data: thresholds } = await supabase
      .from('sla_thresholds')
      .select('max_hourly_failure_rate, failure_alert_min_samples')
      .limit(1)
      .maybeSingle();

    if (thresholds) {
      FAILURE_THRESHOLD = thresholds.max_hourly_failure_rate;
      MIN_SAMPLES = thresholds.failure_alert_min_samples;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Get emails from the last hour
    const { data: recentEmails, error: emailError } = await supabase
      .from('email_log')
      .select('id, status')
      .gte('created_at', oneHourAgo);

    if (emailError) throw emailError;
    if (!recentEmails?.length || recentEmails.length < MIN_SAMPLES) {
      return jsonResponse({ message: 'Not enough emails to evaluate', count: recentEmails?.length ?? 0, minSamples: MIN_SAMPLES });
    }

    const failedCount = recentEmails.filter((e: any) => e.status === 'failed').length;
    const failureRate = Math.round((failedCount / recentEmails.length) * 100);

    if (failureRate <= FAILURE_THRESHOLD) {
      return jsonResponse({ message: 'Failure rate within threshold', failureRate, threshold: FAILURE_THRESHOLD });
    }

    // Get all admin user IDs
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError) throw rolesError;
    if (!adminRoles?.length) {
      return jsonResponse({ message: 'No admins to notify', failureRate });
    }

    // Insert notification for each admin
    const notifications = adminRoles.map((r: any) => ({
      user_id: r.user_id,
      title: '⚠️ High Email Failure Rate',
      message: `${failureRate}% of emails failed in the last hour (${failedCount} of ${recentEmails.length}). Check the Email Delivery Log in Admin Panel for details.`,
      type: 'warning',
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) throw insertError;

    return jsonResponse({
      message: 'Admin notifications sent',
      failureRate,
      failedCount,
      total: recentEmails.length,
      adminsNotified: adminRoles.length,
    });
  } catch (err) {
    console.error('Failure rate check error:', err);
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
