import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HighRiskAlertRequest {
  claim_id: string;
  claim_number: string;
  claimant_name: string;
  claim_amount: number;
  risk_score: number;
  risk_category: string;
  user_email: string;
  description?: string;
  incident_location?: string;
}

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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: HighRiskAlertRequest = await req.json();
    
    console.log("Processing high-risk claim alert:", payload);

    // Get all SIU analysts to notify
    const { data: siuUsers, error: siuError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "siu_analyst");

    if (siuError) {
      console.error("Error fetching SIU users:", siuError);
    }

    // Also get admins
    const { data: adminUsers, error: adminError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminError) {
      console.error("Error fetching admin users:", adminError);
    }

    const allRecipientIds = [
      ...(siuUsers || []).map(u => u.user_id),
      ...(adminUsers || []).map(u => u.user_id),
    ];

    // Get unique user IDs
    const uniqueRecipientIds = [...new Set(allRecipientIds)];

    console.log(`Found ${uniqueRecipientIds.length} SIU/Admin users to notify`);

    // Get email addresses for all recipients
    let recipientEmails: string[] = [];
    if (uniqueRecipientIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", uniqueRecipientIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      } else {
        recipientEmails = profiles?.map(p => p.email).filter(Boolean) || [];
      }
    }

    // Create notifications for all SIU team members and admins
    const notifications = uniqueRecipientIds.map(userId => ({
      user_id: userId,
      title: `🚨 HIGH-RISK CLAIM ALERT`,
      message: `Claim ${payload.claim_number} for ${payload.claimant_name} has been flagged as HIGH RISK with a score of ${payload.risk_score}%. Amount: $${payload.claim_amount.toLocaleString()}. Immediate SIU review required.`,
      type: "error",
      claim_id: payload.claim_id,
    }));

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Failed to create notifications:", notificationError);
      } else {
        console.log(`Created ${notifications.length} in-app notifications`);
      }
    }

    // Send email alerts via Resend
    let emailResult = null;
    if (resendApiKey && recipientEmails.length > 0) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚨 HIGH-RISK CLAIM ALERT</h1>
                <p style="color: #e0e7ef; margin: 10px 0 0; font-size: 14px;">Karthikeya ClaimGuard Platform</p>
              </div>
              
              <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
                  <p style="margin: 0; color: #991b1b; font-weight: 600;">Immediate SIU Investigation Required</p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Claim Number</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 600; text-align: right;">${payload.claim_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Claimant</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 600; text-align: right;">${payload.claimant_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Claim Amount</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: 700; text-align: right; font-size: 18px;">$${payload.claim_amount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Risk Score</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                      <span style="background: #dc2626; color: white; padding: 4px 12px; border-radius: 20px; font-weight: 600;">${payload.risk_score}% HIGH RISK</span>
                    </td>
                  </tr>
                  ${payload.incident_location ? `
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Location</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; text-align: right;">${payload.incident_location}</td>
                  </tr>
                  ` : ''}
                </table>

                ${payload.description ? `
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Description</p>
                  <p style="margin: 0; color: #374151; font-size: 14px;">${payload.description}</p>
                </div>
                ` : ''}

                <p style="margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center;">
                  This is an automated alert from Karthikeya ClaimGuard Platform.<br>
                  Please log in to review this claim.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

        emailResult = await sendEmailViaResend(
          resendApiKey,
          recipientEmails,
          `🚨 HIGH-RISK ALERT: Claim ${payload.claim_number} - $${payload.claim_amount.toLocaleString()} - Score ${payload.risk_score}%`,
          emailHtml
        );

        console.log("Email sent successfully:", emailResult);
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        emailResult = { error: String(emailError) };
      }
    } else {
      console.log("Skipping email: RESEND_API_KEY not configured or no recipients found");
      console.log("RESEND_API_KEY present:", !!resendApiKey);
      console.log("Recipient emails:", recipientEmails);
    }

    // Log the alert for audit purposes
    const alertDetails = {
      timestamp: new Date().toISOString(),
      claim_number: payload.claim_number,
      claimant: payload.claimant_name,
      amount: payload.claim_amount,
      risk_score: payload.risk_score,
      risk_category: payload.risk_category,
      action: "HIGH_RISK_ALERT_SENT",
      recipients_notified: uniqueRecipientIds.length,
      emails_sent_to: recipientEmails,
      email_result: emailResult,
    };

    console.log("High-risk alert processed:", JSON.stringify(alertDetails));

    // Create a claim event for audit trail
    await supabase.from("claim_events").insert({
      claim_id: payload.claim_id,
      event_type: "high_risk_alert_sent",
      event_data: alertDetails,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "High-risk alert processed successfully",
        notifications_created: notifications.length,
        emails_sent: recipientEmails.length,
        alert: alertDetails,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error("Error processing high-risk alert:", errorMessage);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
