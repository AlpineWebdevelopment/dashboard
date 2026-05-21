import { NextRequest, NextResponse } from "next/server";

const BASE = "https://graph.facebook.com/v19.0";

function act() {
  return `act_${process.env.META_AD_ACCOUNT_ID ?? ""}`;
}

// ─── Token management ────────────────────────────────────────────
// We keep a refreshed token in memory across requests (resets on cold start).
// If the env token is still valid, we use that. If Meta returns an expiry error,
// we exchange it for a fresh 60-day token using App ID + Secret.

let cachedToken = process.env.META_ACCESS_TOKEN ?? "";

async function refreshToken(): Promise<string> {
  const appId     = process.env.META_APP_ID ?? "";
  const appSecret = process.env.META_APP_SECRET ?? "";
  if (!appId || !appSecret) throw new Error("META_APP_ID / META_APP_SECRET not set");

  const url = new URL("https://graph.facebook.com/oauth/access_token");
  url.searchParams.set("grant_type",       "fb_exchange_token");
  url.searchParams.set("client_id",        appId);
  url.searchParams.set("client_secret",    appSecret);
  url.searchParams.set("fb_exchange_token", cachedToken);

  const res  = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Token refresh failed");

  cachedToken = json.access_token;
  return cachedToken;
}

async function metaGet(
  path: string,
  params: Record<string, string> = {},
  retry = true
): Promise<any> {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", cachedToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res  = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();

  // Auto-refresh on token expiry then retry once
  if (json.error) {
    const code = json.error.code;
    const isExpired = code === 190 || code === 102;
    if (isExpired && retry) {
      await refreshToken();
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

        const data = await metaGet(`${act()}/insights`, {
          fields: [
            "ad_id",
            "impressions",
            "reach",
            "inline_link_clicks",
            "inline_link_click_ctr",
            "spend",
            "cost_per_inline_link_click",
            "cost_per_result",
          ].join(","),
          level: "ad",
          date_preset: params.datePreset ?? "last_30d",
          filtering,
          limit: "500",
        });

        const byAdId: Record<string, object> = {};
        for (const row of data.data ?? []) {
          const cpr = Array.isArray(row.cost_per_result)
            ? (row.cost_per_result[0]?.value ?? null)
            : null;
          byAdId[row.ad_id] = {
            impressions:   row.impressions ?? "0",
            reach:         row.reach ?? "0",
            linkClicks:    row.inline_link_clicks ?? "0",
            ctr:           row.inline_link_click_ctr ?? "0",
            spend:         row.spend ?? "0",
            costPerClick:  row.cost_per_inline_link_click ?? null,
            costPerResult: cpr,
            updatedAt:     new Date().toISOString(),
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
