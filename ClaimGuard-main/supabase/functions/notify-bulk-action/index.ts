import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BulkActionRequest {
  action: string;
  affected_claim_numbers: string[];
  count: number;
  performed_by_name: string;
  assigned_to_name?: string;
  assigned_group?: string;
}

const ACTION_LABELS: Record<string, string> = {
  bulk_approved: "Approved",
  bulk_rejected: "Rejected",
  bulk_siu_investigation: "Escalated to SIU",
  bulk_reassign: "Reassigned",
};

const ACTION_COLORS: Record<string, string> = {
  bulk_approved: "#16a34a",
  bulk_rejected: "#dc2626",
  bulk_siu_investigation: "#f59e0b",
  bulk_reassign: "#3b82f6",
};

// Maps bulk action types to notification_preferences column names
const ACTION_PREF_MAP: Record<string, string> = {
  bulk_approved: "email_bulk_approved",
  bulk_rejected: "email_bulk_rejected",
  bulk_siu_investigation: "email_bulk_siu_investigation",
  bulk_reassign: "email_bulk_reassign",
};

async function sendEmailViaResend(apiKey: string, to: string[], subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ClaimGuard Alerts <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: BulkActionRequest = await req.json();

    console.log("Processing bulk action notification:", payload);

    const actionLabel = ACTION_LABELS[payload.action] || payload.action;
    const actionColor = ACTION_COLORS[payload.action] || "#6b7280";

    // Get all adjusters and admins to notify
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["adjuster", "admin", "siu_analyst"]);

    const recipientIds = [...new Set((roles || []).map(r => r.user_id))];

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No recipients found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create in-app notifications (always, regardless of email preferences)
    const notifications = recipientIds.map(userId => ({
      user_id: userId,
      title: `Bulk ${actionLabel}: ${payload.count} claim${payload.count !== 1 ? "s" : ""}`,
      message: `${payload.performed_by_name} ${actionLabel.toLowerCase()} ${payload.count} claim${payload.count !== 1 ? "s" : ""}: ${payload.affected_claim_numbers.join(", ")}${payload.assigned_to_name ? ` → ${payload.assigned_to_name}` : ""}`,
      type: payload.action === "bulk_rejected" || payload.action === "bulk_siu_investigation" ? "warning" : "info",
    }));

    const { error: notifError } = await supabase.from("notifications").insert(notifications);
    if (notifError) console.error("Notification insert error:", notifError);

    // Send email via Resend (respecting user preferences)
    let emailResult = null;
    if (resendApiKey) {
      // Fetch notification preferences for all recipients
      const prefColumn = ACTION_PREF_MAP[payload.action];
      let emailRecipientIds = recipientIds;

      if (prefColumn) {
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("user_id, " + prefColumn)
          .in("user_id", recipientIds);

        if (prefs && prefs.length > 0) {
          // Users with preferences set: filter those who opted out
          const optedOutUserIds = new Set(
            prefs.filter(p => p[prefColumn] === false).map(p => p.user_id)
          );
          emailRecipientIds = recipientIds.filter(id => !optedOutUserIds.has(id));
        }
        // If no preferences exist for a user, default is true (send email)
      }

      if (emailRecipientIds.length === 0) {
        console.log("All recipients opted out of this notification type");
      } else {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", emailRecipientIds);

        const emails = (profiles || []).map(p => p.email).filter(Boolean);

        if (emails.length > 0) {
          const claimList = payload.affected_claim_numbers
            .map(n => `<li style="padding:4px 0;font-family:monospace;font-size:14px;">${n}</li>`)
            .join("");

          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family:'Inter',Arial,sans-serif;margin:0;padding:0;background-color:#f5f7fa;">
              <div style="max-width:600px;margin:0 auto;padding:20px;">
                <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2d4a6f 100%);border-radius:12px 12px 0 0;padding:30px;text-align:center;">
                  <h1 style="color:#ffffff;margin:0;font-size:22px;">Bulk Action Performed</h1>
                  <p style="color:#e0e7ef;margin:10px 0 0;font-size:14px;">ClaimGuard Platform</p>
                </div>
                <div style="background:#ffffff;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                  <div style="background:${actionColor}15;border-left:4px solid ${actionColor};padding:15px;margin-bottom:20px;border-radius:0 8px 8px 0;">
                    <p style="margin:0;color:${actionColor};font-weight:700;font-size:18px;">${actionLabel}</p>
                    <p style="margin:4px 0 0;color:#374151;font-size:14px;">${payload.count} claim${payload.count !== 1 ? "s" : ""} affected</p>
                  </div>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Performed By</td>
                      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;text-align:right;">${payload.performed_by_name}</td>
                    </tr>
                    ${payload.assigned_to_name ? `
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Assigned To</td>
                      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;text-align:right;">${payload.assigned_to_name}</td>
                    </tr>` : ""}
                    ${payload.assigned_group ? `
                    <tr>
                      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Group</td>
                      <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;text-align:right;">${payload.assigned_group}</td>
                    </tr>` : ""}
                  </table>
                  <p style="color:#6b7280;font-size:13px;margin-bottom:8px;">Affected Claims:</p>
                  <ul style="list-style:none;padding:0;margin:0 0 20px;background:#f9fafb;border-radius:8px;padding:12px 16px;">${claimList}</ul>
                  <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;text-align:center;">
                    Automated alert from ClaimGuard Platform. Manage your notification preferences in Settings.
                  </p>
                </div>
              </div>
            </body>
            </html>`;

          try {
            emailResult = await sendEmailViaResend(
              resendApiKey,
              emails,
              `Bulk ${actionLabel}: ${payload.count} claim${payload.count !== 1 ? "s" : ""} — ClaimGuard`,
              emailHtml
            );
            console.log("Bulk action email sent:", emailResult);
          } catch (emailError) {
            console.error("Email send failed:", emailError);
            emailResult = { error: String(emailError) };
          }
        }
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email");
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notifications.length,
        email_result: emailResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
