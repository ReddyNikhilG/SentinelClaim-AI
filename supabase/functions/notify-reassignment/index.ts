import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReassignmentRequest {
  assigned_to_user_id: string;
  claim_ids: string[];
  claim_numbers: string[];
  assigned_group: string | null;
  reassigned_by: string;
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
    const payload: ReassignmentRequest = await req.json();

    // Get assignee profile
    const { data: assignee } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", payload.assigned_to_user_id)
      .single();

    // Get reassigner profile
    const { data: reassigner } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", payload.reassigned_by)
      .single();

    if (!assignee) {
      return new Response(JSON.stringify({ success: false, error: "Assignee not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_id: payload.assigned_to_user_id,
      title: "Claims Reassigned to You",
      message: `${payload.claim_numbers.length} claim(s) (${payload.claim_numbers.join(", ")}) have been reassigned to you${payload.assigned_group ? ` in ${payload.assigned_group}` : ""} by ${reassigner?.full_name || "an admin"}.`,
      type: "info",
      claim_id: payload.claim_ids[0],
    });

    // Send email via Resend
    if (resendApiKey && assignee.email) {
      const claimList = payload.claim_numbers.map(n => `<li style="padding:4px 0;">${n}</li>`).join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f7fa;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1e3a5f, #2d4a6f); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">📋 Claims Reassigned to You</h1>
            </div>
            <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="color: #374151;">Hi ${assignee.full_name},</p>
              <p style="color: #374151;">${reassigner?.full_name || "An admin"} has reassigned the following ${payload.claim_numbers.length} claim(s) to you${payload.assigned_group ? ` under <strong>${payload.assigned_group}</strong>` : ""}:</p>
              <ul style="color: #1e3a5f; font-weight: 600;">${claimList}</ul>
              <p style="color: #6b7280; font-size: 13px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                Please log in to ClaimGuard to review these claims.
              </p>
            </div>
          </div>
        </body>
        </html>`;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ClaimGuard Alerts <onboarding@resend.dev>",
            to: [assignee.email],
            subject: `📋 ${payload.claim_numbers.length} claim(s) reassigned to you`,
            html,
          }),
        });
        console.log("Reassignment email sent to:", assignee.email);
      } catch (emailErr) {
        console.error("Failed to send reassignment email:", emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-reassignment:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
