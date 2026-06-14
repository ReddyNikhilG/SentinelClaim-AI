import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a precise data extraction assistant for an insurance claims system. Your job is to extract claim information from a voice transcript and return ONLY valid JSON.

Extract these fields from the transcript:
- claim_type: One of "auto", "property", "liability", "workers_comp", or "health"
- incident_date: Date in YYYY-MM-DD format (parse relative dates like "yesterday", "last week", etc.)
- claim_amount: Numeric value only (no currency symbols)
- incident_location: Full address or location description
- description: Description of what happened
- claimant_name: Full name of the person
- claimant_email: Email address if mentioned
- claimant_phone: Phone number if mentioned
- policy_number: Policy number if mentioned

Guidelines:
- For claim_type, infer from context:
  - "car", "vehicle", "accident", "collision", "crash" → "auto"
  - "house", "home", "building", "fire", "flood", "storm" → "property"
  - "injury to someone else", "third party", "lawsuit" → "liability"
  - "work injury", "workplace", "on the job" → "workers_comp"
  - "medical", "hospital", "doctor", "surgery", "health" → "health"
- For dates, convert to YYYY-MM-DD format. Today's date is ${new Date().toISOString().split('T')[0]}
- For amounts, extract just the number (e.g., "five thousand dollars" → "5000")
- Only include fields that are clearly mentioned in the transcript
- If a field is not mentioned, do not include it in the response

IMPORTANT: Respond with ONLY a JSON object, no markdown, no explanation.`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function inferClaimType(transcript: string): string | undefined {
  const value = transcript.toLowerCase();
  if (/(car|vehicle|accident|collision|crash|hit and run)/.test(value)) return "auto";
  if (/(house|home|building|fire|flood|storm|property)/.test(value)) return "property";
  if (/(third party|lawsuit|liability|injury to someone else)/.test(value)) return "liability";
  if (/(work injury|workplace|on the job|workers comp)/.test(value)) return "workers_comp";
  if (/(medical|hospital|doctor|surgery|health)/.test(value)) return "health";
  return undefined;
}

function inferIncidentDate(transcript: string): string | undefined {
  const value = transcript.toLowerCase();
  const today = new Date();
  if (value.includes("yesterday")) {
    const d = new Date(today);
    d.setDate(today.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  if (value.includes("today")) return today.toISOString().split("T")[0];
  const isoDate = transcript.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoDate) return isoDate[1];
  return undefined;
}

function inferClaimAmount(transcript: string): string | undefined {
  const numeric = transcript.match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
  if (numeric) return numeric[1].replace(/,/g, "");

  const lower = transcript.toLowerCase();
  if (lower.includes("five thousand")) return "5000";
  if (lower.includes("ten thousand")) return "10000";
  if (lower.includes("twenty thousand")) return "20000";
  return undefined;
}

function heuristicExtract(transcript: string): Record<string, string> {
  const output: Record<string, string> = {};
  const claimType = inferClaimType(transcript);
  const incidentDate = inferIncidentDate(transcript);
  const claimAmount = inferClaimAmount(transcript);

  if (claimType) output.claim_type = claimType;
  if (incidentDate) output.incident_date = incidentDate;
  if (claimAmount) output.claim_amount = claimAmount;

  const email = transcript.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) output.claimant_email = email[0];

  const phone = transcript.match(/(?:\+?\d{1,2}[\s-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  if (phone) output.claimant_phone = phone[0];

  const policy = transcript.match(/\b(POL[-\s]?\d{3,})\b/i);
  if (policy) output.policy_number = policy[1].replace(/\s+/g, "-").toUpperCase();

  const name = transcript.match(/(?:my name is|i am)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/i);
  if (name) output.claimant_name = name[1].trim();

  const location = transcript.match(/\bat\s+([^.,]+(?:\s+[^.,]+){0,6})/i);
  if (location) output.incident_location = location[1].trim();

  output.description = transcript.trim();

  return output;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("Karthikeya AI key is not configured");
    }

    if (!transcript || transcript.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No transcript provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `Extract claim information from this voice transcript:\n\n"${transcript}"` }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    });

    let response: Response | null = null;
    const retryDelays = [700, 1400, 2500];
    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: requestBody,
        }
      );

      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) break;
      if (attempt < retryDelays.length - 1) await sleep(retryDelays[attempt]);
    }

    if (!response) {
      const fallback = heuristicExtract(transcript);
      return new Response(JSON.stringify({ data: fallback, warning: "AI temporarily unavailable. Used fallback extraction." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      const fallback = heuristicExtract(transcript);
      return new Response(JSON.stringify({ data: fallback, warning: "AI service busy. Used fallback extraction." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") || "{}";
    
    // Parse the JSON response
    let extractedData;
    try {
      // Remove any markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      extractedData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      const fallback = heuristicExtract(transcript);
      return new Response(JSON.stringify({ 
        data: fallback,
        warning: "Could not parse AI response. Used fallback extraction.",
        raw: content 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Voice parse error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
