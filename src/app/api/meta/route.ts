import { NextRequest, NextResponse } from "next/server";

const BASE = "https://graph.facebook.com/v19.0";

function token() {
  return process.env.META_ACCESS_TOKEN ?? "";
}
function act() {
  return `act_${process.env.META_AD_ACCOUNT_ID ?? ""}`;
}

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", token());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Meta API error");
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

      // ─── List ads inside a specific Meta campaign ────────────────
      case "getAds": {
        const data = await metaGet(`${params.campaignId}/ads`, {
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

        // Build a map of meta_ad_id → insights
        const byAdId: Record<string, object> = {};
        for (const row of data.data ?? []) {
          const cpr = Array.isArray(row.cost_per_result)
            ? (row.cost_per_result[0]?.value ?? null)
            : null;
          byAdId[row.ad_id] = {
            impressions: row.impressions ?? "0",
            reach: row.reach ?? "0",
            linkClicks: row.inline_link_clicks ?? "0",
            ctr: row.inline_link_click_ctr ?? "0",
            spend: row.spend ?? "0",
            costPerClick: row.cost_per_inline_link_click ?? null,
            costPerResult: cpr,
            updatedAt: new Date().toISOString(),
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
