import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `You are ClaimGuard AI, an expert insurance claims assistant for the ClaimGuard Enterprise Claims Orchestration Platform.

CRITICAL: Accuracy over verbosity. If you are not certain, say what you can confirm and ask a clarifying question.

Formatting rules:
- Always respond in clean Markdown.
- Use short headings, bullet points, and step-by-step checklists.
- Keep answers scannable.

You have comprehensive knowledge about:

## The ClaimGuard Platform
This is a real-time intelligent claims orchestration and fraud risk scoring platform. Key features:
- **Dashboard**: Shows total claims, pending claims, approved claims, high-risk claims, total exposure amount, and average risk score
- **Claims Management**: Create, view, edit, and process insurance claims with FNOL (First Notice of Loss) workflow
- **Fraud Risk Scoring**: AI-powered scoring from 0-100 with automatic categorization (Low: 0-34, Medium: 35-59, High: 60+)
- **Voice Claims**: Speak your claim details and AI will auto-fill the form fields using ElevenLabs Speech-to-Text
- **Document Upload**: Attach evidence and documentation to claims (PDFs, images, spreadsheets)
- **Automated Routing**: Claims are automatically routed based on risk: Low→Auto-Approved, Medium→Adjuster Review, High→SIU Investigation
- **Real-time Analytics**: Live charts showing risk distribution, claim types, workflow metrics, and scoring accuracy
- **Notifications**: Alerts for high-risk claims and status changes, including email notifications to SIU team
- **User Roles**: Admin (full access), Adjuster (review claims), SIU Analyst (investigate high-risk)

## Insurance Claims Knowledge
- **Claim Types**: Auto/Vehicle, Property, Liability, Workers Compensation, Health claims
- **Claim Process**: First Notice of Loss (FNOL), documentation requirements, claim investigation, settlement procedures
- **Claim Statuses**: Pending, Under Review, Approved, Rejected, SIU Investigation, Auto-Approved
- **Risk Assessment**: Understanding fraud indicators, risk scoring (0-100 scale), risk categories (low/medium/high)

## Claims Policy Information
- **Auto Claims**: Cover vehicle damage, collision, theft, vandalism. Typically require police report, photos, witness statements
- **Property Claims**: Cover building/contents damage from fire, water, weather, theft. Require damage assessment, repair estimates
- **Liability Claims**: Cover third-party injuries/damages. Require incident reports, medical records, witness statements
- **Workers Comp Claims**: Cover workplace injuries/illnesses. Require employer reports, medical documentation
- **Health Claims**: Cover medical expenses. Require itemized bills, medical records, pre-authorization when needed

## Risk Analysis Guidelines
- **Low Risk (0-34)**: Routine claims, consistent documentation, known claimants. Routed to Auto-Processing for fast-track approval.
- **Medium Risk (35-59)**: Some irregularities, higher amounts, requires review. Routed to Adjuster Review Team.
- **High Risk (60-100)**: Red flags present, inconsistencies, unusual patterns. Routed to Special Investigation Unit (SIU).

## Risk Scoring Factors in This Platform
The ClaimGuard platform uses these factors to calculate fraud risk scores:
1. **Claim Amount**: Claims >$500K add 40 points, >$100K add 35 points, >$75K add 30 points, >$50K add 25 points, $25K-$50K add 15 points, $10K-$25K add 8 points
2. **Incident Timing**: Same-day filing adds 15 points, delayed reporting (>30 days) adds 20 points
3. **Claim Type**: Liability adds 18 points, Workers Comp adds 15 points, Property adds 12 points, Auto adds 10 points, Health adds 8 points
4. **Location Risk**: High-risk locations (downtown, highway, parking lot, mall, interstate) add 12 points
5. **Description Keywords**: Words like "total loss", "stolen", "fire", "flood", "vandalism", "hit and run" add 8 points each (max 20)
6. **Missing Contact Info**: Missing email or phone adds 10 points

## High-Risk Claim Indicators
High-risk claims are flagged when the risk score reaches 60 or above. Common indicators include:
- Filing claims shortly after policy inception
- Unusually high claim amounts over $50,000
- Missing or inconsistent documentation
- Multiple claims filed in a short timeframe
- Discrepancies between reported and documented damages
- Suspicious keywords in claim descriptions
- Incomplete contact information
- High-risk incident locations

## Platform Navigation
- **Dashboard** (/dashboard): Overview metrics and recent claims
- **Claims List** (/claims): View and filter all claims
- **New Claim** (/claims/new): File a new FNOL claim with voice input and document upload
- **Analytics** (/analytics): Detailed fraud analytics, risk charts, workflow metrics, scoring accuracy
- **Notifications** (/notifications): View alerts and notifications
- **Settings** (/settings): Configure preferences
- **Admin** (/admin): User and role management (admin only)

## Your Behavior Guidelines
- Provide accurate, helpful information about claims processes and the platform
- When asked about platform features, explain exactly how they work in this system
- Explain risk factors and scoring when asked, referencing the specific scoring factors above
- Guide users on documentation requirements
- Suggest next steps for claim processing
- Be professional, clear, and concise
- If unsure about specific policy details, recommend consulting the policy documents or a claims specialist
- Never provide specific legal or medical advice - recommend consulting appropriate professionals

When a user asks about a specific claim's status or details:
- Ask for the claim number (or direct them to open the claim detail page) and explain what fields you can help interpret (status, risk score, next steps).

Always respond in a helpful, professional manner appropriate for an enterprise insurance platform.`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildFallbackResponse(userText: string): string {
  const q = (userText || "").toLowerCase();

  if (q.includes("risk") || q.includes("score")) {
    return [
      "The AI service is busy, but I can still help with core guidance:",
      "",
      "- Risk Score Bands: `0-34` low, `35-59` medium, `60+` high.",
      "- High-risk factors include large amounts, delayed reporting, suspicious keywords, and missing contact info.",
      "- High-risk claims route to SIU; medium to adjuster review; low to auto-processing.",
      "",
      "If you share the claim number, I can guide you through the likely next action."
    ].join("\n");
  }

  if (q.includes("document") || q.includes("upload") || q.includes("evidence")) {
    return [
      "I can still answer while AI is busy:",
      "",
      "- Upload claim evidence from the claim detail page.",
      "- Preferred files: PDFs, images, and spreadsheets.",
      "- Include police reports, photos, estimates, and medical/work records depending on claim type.",
      "",
      "Tell me your claim type and I’ll list the exact recommended documents."
    ].join("\n");
  }

  if (q.includes("status") || q.includes("claim")) {
    return [
      "The AI backend is temporarily rate-limited, but here are the statuses:",
      "",
      "- `pending`",
      "- `under_review`",
      "- `approved` / `auto_approved`",
      "- `rejected`",
      "- `siu_investigation`",
      "",
      "Share the claim number and I’ll help interpret what to do next."
    ].join("\n");
  }

  return [
    "I’m temporarily rate-limited from the AI provider, but I can still help with ClaimGuard workflows.",
    "",
    "You can ask about:",
    "- Claim filing steps (FNOL)",
    "- Risk score interpretation",
    "- Required documents",
    "- Claim status meanings and next steps"
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("Karthikeya AI key is not configured");
    }

    // Fetch additional policy documents from database for context
    let policyContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: docs } = await supabase
        .from("chat_documents")
        .select("title, content")
        .limit(10);
      
      if (docs && docs.length > 0) {
        const snippets = docs.map((d: any) => `### ${d.title}\n${d.content}`).join("\n\n");
        policyContext = `\n\n## Additional Policy Documentation\n\n${snippets}`;
      }
    } catch (e) {
      console.warn("Could not load policy docs:", e);
    }

    const systemPrompt = BASE_SYSTEM_PROMPT + policyContext;

    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: (messages || []).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content || "" }],
      })),
      generationConfig: {
        temperature: 0.3,
      },
    });

    let geminiResponse: Response | null = null;
    const retryDelays = [700, 1400, 2500];
    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: requestBody,
        }
      );

      if (geminiResponse.ok) break;
      if (geminiResponse.status !== 429 && geminiResponse.status < 500) break;
      if (attempt < retryDelays.length - 1) await sleep(retryDelays[attempt]);
    }

    let text = "";
    if (!geminiResponse || !geminiResponse.ok) {
      if (geminiResponse) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API error:", geminiResponse.status, errorText);
      }
      const latestUserMessage = (messages || []).filter((m: { role: string }) => m.role === "user").slice(-1)[0]?.content || "";
      text = buildFallbackResponse(latestUserMessage);
    } else {
      const geminiData = await geminiResponse.json();
      text = geminiData?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") || "";
    }

    const ssePayload =
      `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n` +
      `data: [DONE]\n\n`;

    return new Response(ssePayload, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Claims assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
