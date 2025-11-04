import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExternalUser {
  id: string;
  email: string;
  name: string;
  status: string;
  last_login: string | null;
  created_at: string;
}

interface ExternalApplication {
  id: string;
  name: string;
  application_id: string;
  status: string;
  url: string;
  users_count: number;
  environment_urls: {
    development: string | null;
    testing: string | null;
    production: string | null;
  };
  users: ExternalUser[];
  created_at: string;
  updated_at: string;
}

interface ExternalAPIResponse {
  success: boolean;
  data: {
    applications: ExternalApplication[];
    total: number;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const cronSecret = url.searchParams.get("secret");
    const authHeader = req.headers.get("Authorization");

    const expectedCronSecret = Deno.env.get("CRON_SECRET") || "default_cron_secret_change_me";
    const validCronAuth = cronSecret && cronSecret === expectedCronSecret;
    const validBearerAuth = authHeader?.startsWith("Bearer ");

    if (!validCronAuth && !validBearerAuth) {
      console.warn("Unauthorized sync attempt");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized - provide valid authentication",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting application sync from external auth system...");

    const externalApiUrl = "https://auth-systemv1.netlify.app/api/application/info";

    const response = await fetch(externalApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`External API returned status ${response.status}`);
    }

    const externalData: ExternalAPIResponse = await response.json();

    if (!externalData.success || !externalData.data || !externalData.data.applications) {
      throw new Error("Invalid response format from external API");
    }

    const externalApps = externalData.data.applications;
    console.log(`Fetched ${externalApps.length} applications from external system`);

    const { data: existingApps, error: fetchError } = await supabase
      .from("applications")
      .select("external_app_id, id, name");

    if (fetchError) {
      throw new Error(`Failed to fetch existing applications: ${fetchError.message}`);
    }

    const existingExternalIds = new Set(
      existingApps?.map((app) => app.external_app_id) || []
    );

    const results = {
      total_external: externalApps.length,
      already_exists: 0,
      newly_created: 0,
      failed: 0,
      total_users_synced: 0,
      created_apps: [] as any[],
      errors: [] as string[],
    };

    for (const extApp of externalApps) {
      if (existingExternalIds.has(extApp.application_id)) {
        results.already_exists++;
        console.log(`Application ${extApp.name} (${extApp.application_id}) already exists, skipping...`);
        continue;
      }

      const slug = extApp.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const newApp = {
        name: extApp.name,
        slug: slug,
        external_app_id: extApp.application_id,
        webhook_url: extApp.url,
        settings: {
          external_id: extApp.id,
          status: extApp.status,
          environment_urls: extApp.environment_urls,
          synced_at: new Date().toISOString(),
        },
        is_active: extApp.status === "active",
      };

      const { data: createdApp, error: insertError } = await supabase
        .from("applications")
        .insert(newApp)
        .select()
        .single();

      if (insertError) {
        results.failed++;
        results.errors.push(
          `Failed to create ${extApp.name}: ${insertError.message}`
        );
        console.error(`Error creating ${extApp.name}:`, insertError);
        continue;
      }

      results.newly_created++;
      results.created_apps.push({
        name: createdApp.name,
        slug: createdApp.slug,
        external_app_id: createdApp.external_app_id,
        api_key: createdApp.api_key,
      });

      console.log(`Created application: ${createdApp.name} (${createdApp.external_app_id})`);
    }

    // Sync users for all applications
    console.log("Starting user synchronization...");

    for (const extApp of externalApps) {
      if (!extApp.users || extApp.users.length === 0) {
        console.log(`No users to sync for ${extApp.name}`);
        continue;
      }

      // Find the internal application ID
      const internalApp = existingApps?.find(
        app => app.external_app_id === extApp.application_id
      ) || results.created_apps.find(
        app => app.external_app_id === extApp.application_id
      );

      if (!internalApp) {
        console.error(`Could not find internal app for ${extApp.application_id}`);
        continue;
      }

      const appId = internalApp.id;

      // Sync each user
      for (const user of extApp.users) {
        const userData = {
          application_id: appId,
          external_user_id: user.id,
          email: user.email,
          name: user.name,
          status: user.status,
          last_login: user.last_login,
          metadata: {
            synced_at: new Date().toISOString(),
          },
        };

        // Upsert user (insert or update if exists)
        const { error: upsertError } = await supabase
          .from("application_users")
          .upsert(userData, {
            onConflict: "application_id,external_user_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`Failed to sync user ${user.email} for ${extApp.name}:`, upsertError);
          results.errors.push(
            `Failed to sync user ${user.email}: ${upsertError.message}`
          );
        } else {
          results.total_users_synced++;
        }
      }

      console.log(`Synced ${extApp.users.length} users for ${extApp.name}`);
    }

    const summaryMessage = `
      Sync completed successfully!
      - Total applications from external system: ${results.total_external}
      - Already registered: ${results.already_exists}
      - Newly created: ${results.newly_created}
      - Failed: ${results.failed}
      - Total users synced: ${results.total_users_synced}
    `;

    console.log(summaryMessage);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Application sync completed",
        summary: {
          total_external: results.total_external,
          already_exists: results.already_exists,
          newly_created: results.newly_created,
          failed: results.failed,
          total_users_synced: results.total_users_synced,
        },
        created_applications: results.created_apps,
        errors: results.errors,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});