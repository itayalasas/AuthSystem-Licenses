import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExternalMember {
  id: string;
  email: string;
  name: string;
  status: string;
  last_login: string | null;
  created_at: string;
}

interface ExternalTenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  members: ExternalMember[];
}

interface ExternalUser {
  id: string;
  tenant_id: string | null;
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
  auth_type: string;
  environment_urls: {
    development: string | null;
    testing: string | null;
    production: string | null;
  };
  users: ExternalUser[];
  tenants?: ExternalTenant[];
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
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const cronSecret = url.searchParams.get("secret");
    const authHeader = req.headers.get("Authorization");

    const expectedCronSecret = Deno.env.get("CRON_SECRET") || "default_cron_secret_change_me";
    const validCronAuth = cronSecret && cronSecret === expectedCronSecret;
    const validBearerAuth = authHeader?.startsWith("Bearer ");

    if (!validCronAuth && !validBearerAuth) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const externalApiUrl = "https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/application-info";
    // Try both secret names for backward compatibility
    const externalApiKey = Deno.env.get("EXTERNAL_AUTH_API_KEY") || Deno.env.get("EXTERNAL_AUTH_API_TOKEN");

    if (!externalApiKey || externalApiKey.trim() === "") {
      throw new Error("EXTERNAL_AUTH_API_KEY (or EXTERNAL_AUTH_API_TOKEN) is required but not set or empty");
    }

    const trimmedKey = externalApiKey.trim();
    console.log("External API Key found, length:", trimmedKey.length, "prefix:", trimmedKey.substring(0, 6));

    // Try X-API-Key first, then fall back to Authorization: Bearer
    let response = await fetch(externalApiUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-API-Key": trimmedKey },
    });

    if (response.status === 401) {
      console.log("X-API-Key returned 401, retrying with Authorization: Bearer...");
      response = await fetch(externalApiUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${trimmedKey}` },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`External API returned status ${response.status}: ${errorText}`);
    }

    const externalData: ExternalAPIResponse = await response.json();

    if (!externalData.success || !externalData.data?.applications) {
      throw new Error("Invalid response format from external API");
    }

    const externalApps = externalData.data.applications;
    console.log(`Fetched ${externalApps.length} applications`);

    const { data: existingApps } = await supabase
      .from("applications")
      .select("external_app_id, id, name, auth_type");

    const appByExternalId = new Map(
      (existingApps || []).map((a) => [a.external_app_id, a])
    );

    const results = {
      total_external: externalApps.length,
      apps_created: 0,
      apps_updated: 0,
      apps_failed: 0,
      users_synced: 0,
      tenants_created: 0,
      tenants_updated: 0,
      tenant_members_synced: 0,
      errors: [] as string[],
    };

    // Track which external_app_ids are active in AuthSystem for deactivation pass
    const activeExternalIds = new Set(externalApps.map(a => a.application_id));

    // Deactivate apps that no longer exist in AuthSystem
    const appsToDeactivate = (existingApps || []).filter(
      a => !activeExternalIds.has(a.external_app_id) && a.is_active
    );
    if (appsToDeactivate.length > 0) {
      const ids = appsToDeactivate.map(a => a.id);
      await supabase.from("applications").update({ is_active: false }).in("id", ids);
      console.log(`Deactivated ${ids.length} apps no longer in AuthSystem`);
    }

    for (const extApp of externalApps) {
      const authType = extApp.auth_type || "basic";
      const existingApp = appByExternalId.get(extApp.application_id);

      let internalAppId: string;

      const slug = extApp.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (existingApp) {
        // Always update all fields from AuthSystem — name, slug, url, auth_type, status
        const { error: updateError } = await supabase
          .from("applications")
          .update({
            name: extApp.name,
            slug,
            webhook_url: extApp.url,
            auth_type: authType,
            is_active: extApp.status === "active",
            settings: {
              external_id: extApp.id,
              status: extApp.status,
              environment_urls: extApp.environment_urls,
              synced_at: new Date().toISOString(),
            },
          })
          .eq("id", existingApp.id);

        if (updateError) {
          results.apps_failed++;
          results.errors.push(`Failed to update ${extApp.name}: ${updateError.message}`);
          continue;
        }
        internalAppId = existingApp.id;
        results.apps_updated++;
      } else {
        const { data: createdApp, error: insertError } = await supabase
          .from("applications")
          .insert({
            name: extApp.name,
            slug,
            external_app_id: extApp.application_id,
            webhook_url: extApp.url,
            auth_type: authType,
            is_active: extApp.status === "active",
            settings: {
              external_id: extApp.id,
              status: extApp.status,
              environment_urls: extApp.environment_urls,
              synced_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (insertError || !createdApp) {
          results.apps_failed++;
          results.errors.push(`Failed to create ${extApp.name}: ${insertError?.message}`);
          continue;
        }

        internalAppId = createdApp.id;
        results.apps_created++;
        console.log(`Created app: ${extApp.name}`);
      }

      // ── Sync users ──────────────────────────────────────────────────────────
      if (extApp.users?.length) {
        for (const user of extApp.users) {
          if (!user.email?.trim()) continue;

          await supabase.from("application_users").upsert(
            {
              application_id: internalAppId,
              external_user_id: user.id,
              email: user.email,
              name: user.name,
              status: user.status,
              last_login: user.last_login,
              metadata: { synced_at: new Date().toISOString() },
            },
            { onConflict: "application_id, external_user_id" }
          );

          results.users_synced++;

          // Every user always gets their own personal tenant (basic auth path).
          // For tenant-type apps, users with a tenant_id also belong to a shared tenant (below).
          const { data: personalTenant } = await supabase
            .from("tenants")
            .select("id")
            .eq("owner_user_id", user.id)
            .maybeSingle();

          let personalTenantId = personalTenant?.id;

          if (!personalTenantId) {
            const tenantName = user.name?.trim() || user.email;
            const { data: newTenant, error: tenantErr } = await supabase
              .from("tenants")
              .insert({
                name: tenantName,
                organization_name: `${tenantName} Org`,
                owner_user_id: user.id,
                owner_email: user.email,
                billing_email: user.email,
                metadata: {
                  auto_created: true,
                  created_from_sync: true,
                  application_id: extApp.application_id,
                  synced_at: new Date().toISOString(),
                },
              })
              .select("id")
              .single();

            if (tenantErr || !newTenant) {
              results.errors.push(`Failed to create personal tenant for ${user.email}: ${tenantErr?.message}`);
              continue;
            }

            personalTenantId = newTenant.id;
            results.tenants_created++;
          }

          // Link personal tenant → application
          const { data: existingRel } = await supabase
            .from("tenant_applications")
            .select("id")
            .eq("tenant_id", personalTenantId)
            .eq("application_id", internalAppId)
            .maybeSingle();

          if (!existingRel) {
            await supabase.from("tenant_applications").insert({
              tenant_id: personalTenantId,
              application_id: internalAppId,
              status: "active",
              granted_by: "auto_sync",
              notes: `Auto-synced from ${extApp.name}`,
            });
          }
        }
      }

      // ── Sync shared tenants (only for tenant/hybrid apps) ──────────────────
      if ((authType === "tenant" || authType === "hybrid") && extApp.tenants?.length) {
        for (const extTenant of extApp.tenants) {
          // Find or create the shared tenant by auth_tenant_id
          const { data: existingShared } = await supabase
            .from("tenants")
            .select("id")
            .eq("auth_tenant_id", extTenant.id)
            .maybeSingle();

          let sharedTenantId = existingShared?.id;

          if (!sharedTenantId) {
            // Try by slug first
            let foundExisting: { id: string } | null = null;

            if (extTenant.slug) {
              const { data: bySlug } = await supabase
                .from("tenants")
                .select("id")
                .eq("slug", extTenant.slug)
                .maybeSingle();
              if (bySlug) foundExisting = bySlug;
            }

            // Fallback: match by name (case-insensitive) when slug didn't match
            if (!foundExisting) {
              const { data: byNameRows } = await supabase
                .from("tenants")
                .select("id")
                .ilike("name", extTenant.name)
                .is("auth_tenant_id", null)
                .limit(1);
              if (byNameRows && byNameRows.length > 0) foundExisting = byNameRows[0];
            }

            if (foundExisting) {
              // Claim this tenant by setting auth_tenant_id and syncing fields
              const { error: claimErr } = await supabase.from("tenants").update({
                auth_tenant_id: extTenant.id,
                name: extTenant.name,
                slug: extTenant.slug,
                domain: extTenant.domain,
                status: extTenant.status,
              }).eq("id", foundExisting.id);
              if (claimErr) {
                results.errors.push(`Failed to claim tenant ${extTenant.name}: ${claimErr.message}`);
                continue;
              }
              sharedTenantId = foundExisting.id;
              results.tenants_updated++;
              console.log(`Claimed existing tenant ${extTenant.name} (id: ${sharedTenantId})`);
            } else {
              console.log(`Creating new shared tenant: ${extTenant.name} (auth_tenant_id: ${extTenant.id})`);
              const { data: newShared, error: sharedErr } = await supabase
                .from("tenants")
                .insert({
                  name: extTenant.name,
                  slug: extTenant.slug,
                  domain: extTenant.domain,
                  auth_tenant_id: extTenant.id,
                  status: extTenant.status,
                  metadata: {
                    auto_created: true,
                    shared_tenant: true,
                    synced_at: new Date().toISOString(),
                  },
                })
                .select("id")
                .single();

              if (sharedErr || !newShared) {
                results.errors.push(`Failed to create shared tenant ${extTenant.name}: ${sharedErr?.message}`);
                console.error(`Insert error for ${extTenant.name}:`, sharedErr);
                continue;
              }

              sharedTenantId = newShared.id;
              results.tenants_created++;
              console.log(`Created shared tenant: ${extTenant.name} (id: ${sharedTenantId})`);
            }
          } else {
            // Update name/domain in case they changed
            await supabase.from("tenants").update({
              name: extTenant.name,
              slug: extTenant.slug,
              domain: extTenant.domain,
              status: extTenant.status,
            }).eq("id", sharedTenantId);
            results.tenants_updated++;
          }

          // Link shared tenant → application
          const { data: existingSharedRel } = await supabase
            .from("tenant_applications")
            .select("id")
            .eq("tenant_id", sharedTenantId)
            .eq("application_id", internalAppId)
            .maybeSingle();

          if (!existingSharedRel) {
            await supabase.from("tenant_applications").insert({
              tenant_id: sharedTenantId,
              application_id: internalAppId,
              status: "active",
              granted_by: "auto_sync",
              notes: `Shared tenant from ${extApp.name}`,
            });
          }

          // Sync members into tenant_members table
          for (const member of extTenant.members || []) {
            if (!member.email?.trim()) continue;

            await supabase.from("tenant_members").upsert(
              {
                tenant_id: sharedTenantId,
                application_id: internalAppId,
                external_user_id: member.id,
                email: member.email,
                name: member.name,
                status: member.status,
                last_login: member.last_login,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id, external_user_id" }
            );

            results.tenant_members_synced++;
          }
        }
      }
    }

    console.log("Sync completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Application sync completed",
        summary: results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
