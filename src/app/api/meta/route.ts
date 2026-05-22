import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://graph.facebook.com/v19.0";

// Use service role key so RLS doesn't block token reads/writes.
// Falls back to anon key if service role isn't configured yet.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function act() {
  return `act_${process.env.META_AD_ACCOUNT_ID ?? ""}`;
}

// ─── Token helpers ───────────────────────────────────────────────
// Priority: Supabase (persisted long-lived) > env var (fallback)
// After every successful exchange we persist the new token + timestamp.
// If the stored token is >45 days old we proactively extend it.

async function readTokenFromDB(): Promise<{ token: string; extendedAt: string | null } | null> {
  const { data, error } = await supabase
    .from("settings")
    .select("key,value")
    .in("key", ["meta_access_token", "meta_token_extended_at"]);
  if (error || !data) return null;
  const row = (k: string) => data.find((r: any) => r.key === k)?.value ?? null;
  const token = row("meta_access_token");
  if (!token) return null;
  return { token, extendedAt: row("meta_token_extended_at") };
}

async function writeTokenToDB(token: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("settings").upsert([
    { key: "meta_access_token",     value: token },
    { key: "meta_token_extended_at", value: now  },
  ], { onConflict: "key" });
}

async function exchangeToken(token: string): Promise<string> {
  const appId     = process.env.META_APP_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET not set");

  const url = new URL("https://graph.facebook.com/oauth/access_token");
  url.searchParams.set("grant_type",        "fb_exchange_token");
  url.searchParams.set("client_id",         appId);
  url.searchParams.set("client_secret",     appSecret);
  url.searchParams.set("fb_exchange_token", token);

  const res  = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Token exchange failed");
  return json.access_token;
}

// Resolve the best available token and return it.
// Also proactively extends if it hasn't been extended in >45 days.
async function resolveToken(): Promise<string> {
  const stored = await readTokenFromDB();

  if (stored?.token) {
    // Proactively extend if >45 days since last extension.
    // Skip for never-expiring system user tokens (marked with extendedAt="permanent").
    if (stored.extendedAt && stored.extendedAt !== "permanent") {
      const ageMs = Date.now() - new Date(stored.extendedAt).getTime();
      const ageDays = ageMs / 86_400_000;
      if (ageDays > 45) {
        try {
          const fresh = await exchangeToken(stored.token);
          await writeTokenToDB(fresh);
          return fresh;
        } catch {
          // Extension failed — token might be a system user token (already permanent)
          // or genuinely expired. Either way keep using the stored token.
        }
      }
    }
    return stored.token;
  }

  // Nothing in DB — use env var token and immediately try to exchange for long-lived
  const envToken = process.env.META_ACCESS_TOKEN ?? "";
  if (!envToken) throw new Error("No Meta access token configured. Open the Import modal to set one up.");
  try {
    const longLived = await exchangeToken(envToken);
    await writeTokenToDB(longLived);
    return longLived;
  } catch {
    // Exchange failed — might be system user token (already permanent) or expired.
    // Store as-is and hope for the best; user will see auth error if expired.
    return envToken;
  }
}

async function metaGet(
  path: string,
  params: Record<string, string> = {},
  retry = true
): Promise<any> {
  const token = await resolveToken();

  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res  = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();

  if (json.error) {
    const code = json.error.code;
    const isExpiry = code === 190 || code === 102;

    if (isExpiry && retry) {
      // Token is expired — try to get a fresh one from env var
      const envToken = process.env.META_ACCESS_TOKEN ?? "";
      if (!envToken) throw new Error("Meta token expired. Please update META_ACCESS_TOKEN in Vercel env vars.");
      try {
        const fresh = await exchangeToken(envToken);
        await writeTokenToDB(fresh);
      } catch {
        throw new Error("Meta token expired and could not be refreshed. Please go to Vercel → Settings → Environment Variables, update META_ACCESS_TOKEN with a fresh token from developers.facebook.com/tools/explorer, then redeploy.");
      }
      return metaGet(path, params, false);
    }

    throw new Error(json.error.message ?? "Meta API error");
  }

  return json;
}

export async function POST(req: NextRequest) {
  const { action, params = {} } = await req.json();

  try {
    switch (action) {

      // ─── Initialize / refresh token manually ────────────────────
      // Call with { action: "setupToken", params: { token: "<new token>", permanent?: true } }
      // If permanent=true (system user token) we skip exchange and mark it as never-expiring.
      case "setupToken": {
        const raw = params.token?.trim();
        if (!raw) return NextResponse.json({ error: "No token provided" }, { status: 400 });

        if (params.permanent) {
          // System user token — store directly, mark as permanent (no auto-extend needed)
          await supabase.from("settings").upsert([
            { key: "meta_access_token",      value: raw          },
            { key: "meta_token_extended_at",  value: "permanent"  },
          ], { onConflict: "key" });
          return NextResponse.json({ data: { ok: true, message: "System user token saved. This token never expires." } });
        }

        // Regular user token — try to exchange for 60-day long-lived token
        try {
          const longLived = await exchangeToken(raw);
          await writeTokenToDB(longLived);
          return NextResponse.json({ data: { ok: true, message: "Token exchanged and saved — valid for 60 days, auto-extends every 45 days." } });
        } catch (e: any) {
          // Exchange failed — save as-is (might already be long-lived or system user)
          await writeTokenToDB(raw);
          return NextResponse.json({ data: { ok: true, message: "Token saved as-is (exchange failed: " + e.message + ")." } });
        }
      }

      // ─── List all campaigns in the ad account ───────────────────
      case "getCampaigns": {
        const data = await metaGet(`${act()}/campaigns`, {
          fields: "id,name,status,objective",
          limit: "200",
        });
        return NextResponse.json({ data: data.data ?? [] });
      }

      // ─── List ad sets inside a specific Meta campaign ───────────
      case "getAdSets": {
        const data = await metaGet(`${params.campaignId}/adsets`, {
          fields: "id,name,status",
          limit: "500",
        });
        return NextResponse.json({ data: data.data ?? [] });
      }

      // ─── List ads inside a specific Meta ad set ──────────────────
      case "getAds": {
        const data = await metaGet(`${params.adSetId}/ads`, {
          fields: "id,name,status",
          limit: "500",
        });
        return NextResponse.json({ data: data.data ?? [] });
      }

      // ─── Fetch insights for a list of Meta ad IDs ───────────────
      case "syncInsights": {
        const adIds: string[] = params.adIds ?? [];
        if (!adIds.length) return NextResponse.json({ data: {} });

        const filtering = JSON.stringify([
          { field: "ad.id", operator: "IN", value: adIds },
        ]);

        const fields = [
          "ad_id", "impressions", "reach", "inline_link_clicks",
          "ctr", "inline_link_click_ctr", "spend", "cost_per_inline_link_click",
          "cost_per_result", "landing_page_views",
        ].join(",");

        const insightParams: Record<string, string> = {
          fields, level: "ad", filtering, limit: "500",
        };

        if (params.since && params.until) {
          insightParams.time_range = JSON.stringify({ since: params.since, until: params.until });
        } else {
          insightParams.date_preset = params.datePreset ?? "last_30d";
        }

        const data = await metaGet(`${act()}/insights`, insightParams);

        const byAdId: Record<string, object> = {};
        for (const row of data.data ?? []) {
          const cpr = Array.isArray(row.cost_per_result)
            ? (row.cost_per_result[0]?.value ?? null)
            : null;
          byAdId[row.ad_id] = {
            impressions:      row.impressions ?? "0",
            reach:            row.reach ?? "0",
            linkClicks:       row.inline_link_clicks ?? "0",
            ctrAll:           row.ctr ?? null,
            ctr:              row.inline_link_click_ctr ?? "0",
            spend:            row.spend ?? "0",
            costPerClick:     row.cost_per_inline_link_click ?? null,
            costPerResult:    cpr,
            landingPageViews: row.landing_page_views ?? null,
            updatedAt:        new Date().toISOString(),
          };
        }
        return NextResponse.json({ data: byAdId });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
