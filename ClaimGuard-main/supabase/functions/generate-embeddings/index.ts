import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "AI key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch all documents without embeddings
    const { data: docs, error: fetchError } = await supabase
      .from("chat_documents")
      .select("id, title, content")
      .is("embedding", null);

    if (fetchError) throw fetchError;

    if (!docs || docs.length === 0) {
      return new Response(JSON.stringify({ message: "No documents need embeddings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating embeddings for ${docs.length} documents`);

    let successCount = 0;
    const errors: string[] = [];

    for (const doc of docs) {
      try {
        const textToEmbed = `${doc.title}\n\n${doc.content}`;
        
        const response = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: textToEmbed,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          errors.push(`Doc ${doc.id}: ${errText}`);
          continue;
        }

        const data = await response.json();
        const embedding = data?.data?.[0]?.embedding;

        if (!embedding) {
          errors.push(`Doc ${doc.id}: No embedding returned`);
          continue;
        }

        // Update document with embedding
        const { error: updateError } = await supabase
          .from("chat_documents")
          .update({ embedding: JSON.stringify(embedding) })
          .eq("id", doc.id);

        if (updateError) {
          errors.push(`Doc ${doc.id}: ${updateError.message}`);
          continue;
        }

        successCount++;
        console.log(`Generated embedding for: ${doc.title}`);
      } catch (err) {
        errors.push(`Doc ${doc.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Generated embeddings for ${successCount}/${docs.length} documents`,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-embeddings error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
