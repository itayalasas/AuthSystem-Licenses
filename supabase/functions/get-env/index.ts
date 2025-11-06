import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Access-Key",
};

const VALID_ACCESS_KEY = "033b6f38b0c5b902c90dbb1f371c389f967a0afa871028da2ab5657062cab866";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const accessKey = req.headers.get("X-Access-Key");
    
    console.log("Received access key:", accessKey ? "Present" : "Missing");
    console.log("Expected access key:", VALID_ACCESS_KEY);
    
    if (accessKey !== VALID_ACCESS_KEY) {
      console.error("Invalid access key provided");
      return new Response(
        JSON.stringify({ error: "Invalid access key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data, error } = await supabase
      .from("app_config")
      .select("*")
      .single();

    if (error) {
      console.error("Error fetching config:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Configuration fetched successfully");
    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Error in get-env function:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});