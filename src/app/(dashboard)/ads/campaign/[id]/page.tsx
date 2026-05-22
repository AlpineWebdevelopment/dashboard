"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Campaign, Ad, FormatType, ConceptType, MetaInsights,
  CONCEPTS, FORMATS, AWARENESS_TEST_LEVELS, conceptEmojis,
} from "@/types/ads";
import {
  fetchCampaignWithAds,
  insertAd,
  updateAd,
  setAdStatus,
  deleteAdWithVariants,
  updateAdMetaInsights,
} from "@/lib/ads-storage";

/* ─── Meta API helper ────────────────────────────────────────── */

async function metaApi(action: string, params: object = {}) {
  const res = await fetch("/api/meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data;
}

/* ─── Types ─────────────────────────────────────────────────── */

interface MetaCampaign { id: string; name: string; status: string; objective?: string; }
interface MetaAdSet    { id: string; name: string; status: string; }
interface MetaAd       { id: string; name: string; status: string; }

type StatusFilter = "all" | "testing" | "winner" | "loser";
type DatePreset   = "last_7d" | "last_14d" | "last_30d" | "last_90d" | "this_month" | "last_month" | "custom";
type Level        = "adsets" | "ads";

/* ─── Constants ──────────────────────────────────────────────── */

const STATUS = {
  winner:  { bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400", label: "Winner"  },
  loser:   { bar: "bg-red-500",     badge: "bg-red-500/10 text-red-400 border-red-500/20",             dot: "bg-red-400",     label: "Loser"   },
  testing: { bar: "bg-indigo-500",  badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",    dot: "bg-indigo-400",  label: "Testing" },
} as const;

const DURATION_OPTIONS = [3, 5, 7, 10, 14, 21, 30];

const DATE_PRESETS: { label: string; value: DatePreset; metaValue?: string }[] = [
  { label: "Last 7 days",   value: "last_7d",     metaValue: "last_7d"    },
  { label: "Last 14 days",  value: "last_14d",    metaValue: "last_14d"   },
  { label: "Last 30 days",  value: "last_30d",    metaValue: "last_30d"   },
  { label: "Last 90 days",  value: "last_90d",    metaValue: "last_90d"   },
  { label: "This month",    value: "this_month",  metaValue: "this_month" },
  { label: "Last month",    value: "last_month",  metaValue: "last_month" },
  { label: "Custom range",  value: "custom" },
];

/* ─── Helpers ────────────────────────────────────────────────── */

function getProgress(ad: Ad) {
  const elapsed = Date.now() - new Date(ad.createdAt).getTime();
  const total = ad.duration * 86_400_000;
  const percent = Math.min(Math.round((elapsed / total) * 100), 100);
  const daysPassed = Math.min(ad.duration, Math.floor(elapsed / 86_400_000));
  return { percent, daysPassed, done: percent >= 100 };
}

function fmtN(n: string | null | undefined): string {
  if (!n || n === "0") return "—";
  const num = parseFloat(n);
  if (isNaN(num) || num === 0) return "—";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K`;
  return num % 1 === 0 ? String(num) : num.toFixed(0);
}

function fmtDollar(n: string | null | undefined): string {
  if (!n || n === "0") return "—";
  const num = parseFloat(n);
  if (isNaN(num) || num === 0) return "—";
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

function fmtCtr(n: string | null | undefined): string {
  if (!n || n === "0") return "—";
  const num = parseFloat(n);
  if (isNaN(num)) return "—";
  return `${num.toFixed(2)}%`;
}

function generateAnalysisText(campaign: Campaign, ads: Ad[]): string {
  const winners = ads.filter((a) => a.status === "winner");
  const losers  = ads.filter((a) => a.status === "loser");
  const testing = ads.filter((a) => a.status === "testing");
  const formatAd = (ad: Ad, i: number) => [
    `${i + 1}. ${ad.name}`,
    `   Concept: ${ad.concept}  |  Format: ${ad.format}`,
    ad.massDesire   && `   Mass Desire: ${ad.massDesire}`,
    `   Awareness level: ${ad.awareness}`,
    ad.pricingOffer && `   Offer/Pricing: ${ad.pricingOffer}`,
    ad.desire       && `   Hook/Angle: ${ad.desire}`,
    ad.notes        && `   Notes/Learnings: ${ad.notes}`,
    `   Test duration: ${ad.duration} days`,
  ].filter(Boolean).join("\n");
  const usedFormats  = [...new Set(ads.map((a) => a.format))];
  const usedConcepts = [...new Set(ads.map((a) => a.concept))];
  const matrixRows   = usedConcepts.map((concept) => {
    const cells = usedFormats.map((format) => {
      const cell = ads.filter((a) => a.concept === concept && a.format === format);
      if (cell.length === 0) return "—";
      return cell.map((a) => a.status === "winner" ? "WIN" : a.status === "loser" ? "LOSE" : "TEST").join("/");
    });
    return `  ${concept.padEnd(20)} ${cells.join("  ")}`;
  });
  const untestedConcepts = CONCEPTS.filter((c) => !ads.some((a) => a.concept === c));
  return `You are a direct response advertising expert. Analyze the ad test data below and give me specific, honest feedback.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPAIGN: ${campaign.name}  |  Niche: ${campaign.niche}

RESULTS OVERVIEW
Total tests: ${ads.length}  |  Winners: ${winners.length}  |  Losers: ${losers.length}  |  Still testing: ${testing.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${winners.length > 0 ? `\n✅ WINNERS (${winners.length})\n${"─".repeat(40)}\n${winners.map(formatAd).join("\n\n")}\n` : ""}${losers.length > 0 ? `\n❌ LOSERS (${losers.length})\n${"─".repeat(40)}\n${losers.map(formatAd).join("\n\n")}\n` : ""}${testing.length > 0 ? `\n⏳ STILL TESTING (${testing.length})\n${"─".repeat(40)}\n${testing.map(formatAd).join("\n\n")}\n` : ""}
TEST MATRIX (Concept × Format)
${"─".repeat(40)}
Formats: ${usedFormats.join("  |  ")}
${matrixRows.join("\n")}
${untestedConcepts.length > 0 ? `\nCONCEPTS NOT YET TESTED\n${untestedConcepts.map((c) => `  • ${c}`).join("\n")}\n` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please answer:
1. What patterns do you see between winners and losers?
2. Which concept or format looks most promising to double down on?
3. What should I test next to find the next winner?
4. Why do you think the winners are working? (hypothesis)
5. What blind spots or gaps do you see in my testing strategy?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/* ─── Date Filter component ──────────────────────────────────── */

function DateFilter({
  value,
  customSince,
  customUntil,
  loading,
  onSelect,
}: {
  value: DatePreset;
  customSince: string;
  customUntil: string;
  loading: boolean;
  onSelect: (preset: DatePreset, since?: string, until?: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [since, setSince] = useState(customSince || "");
  const [until, setUntil] = useState(customUntil || "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const customLabel = value === "custom" && customSince && customUntil
    ? `${customSince.slice(5)} → ${customUntil.slice(5)}`
    : "Custom";

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {DATE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
        <button
          key={p.value}
          disabled={loading}
          onClick={() => onSelect(p.value)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
            value === p.value
              ? "bg-white/10 border border-white/20 text-white"
              : "border border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]"
          }`}
        >
          {p.label}
        </button>
      ))}

      {/* Custom range */}
      <div className="relative" ref={ref}>
        <button
          disabled={loading}
          onClick={() => setShowPicker(!showPicker)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40 flex items-center gap-1 ${
            value === "custom"
              ? "bg-white/10 border border-white/20 text-white"
              : "border border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]"
          }`}
        >
          📅 {customLabel}
        </button>

        {showPicker && (
          <div className="absolute right-0 top-full mt-2 p-4 bg-[rgba(12,12,20,0.98)] border border-white/[0.12] rounded-xl shadow-2xl z-50 w-72">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Custom date range</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">From</label>
                <input
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">To</label>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
              </div>
              <button
                disabled={!since || !until}
                onClick={() => {
                  onSelect("custom", since, until);
                  setShowPicker(false);
                }}
                className="w-full py-2 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
              >
                Apply range
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <span className="text-[11px] text-sky-400 animate-pulse ml-1">Syncing…</span>
      )}
    </div>
  );
}

/* ─── Meta Import Modal ──────────────────────────────────────── */

function MetaImportModal({
  campaignId, existingMetaIds, onClose, onImported,
}: {
  campaignId: string; existingMetaIds: Set<string>;
  onClose: () => void; onImported: () => void;
}) {
  const [step, setStep]                   = useState<"campaigns" | "adsets" | "ads">("campaigns");
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [metaAdSets, setMetaAdSets]       = useState<MetaAdSet[]>([]);
  const [metaAds, setMetaAds]             = useState<MetaAd[]>([]);
  const [selectedAdSet, setSelectedAdSet] = useState<MetaAdSet | null>(null);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [loading, setLoading]             = useState(true);
  const [importing, setImporting]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [tokenExpired, setTokenExpired]   = useState(false);
  const [newToken, setNewToken]           = useState("");
  const [savingToken, setSavingToken]     = useState(false);

  const isExpiredError = (msg: string) =>
    msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("session") || msg.includes("190") || msg.includes("102");

  const loadCampaigns = () => {
    setLoading(true); setError(null);
    metaApi("getCampaigns")
      .then((d) => { setMetaCampaigns(d); setTokenExpired(false); })
      .catch((e) => { setError(e.message); if (isExpiredError(e.message)) setTokenExpired(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCampaigns(); }, []);

  const [tokenMode, setTokenMode] = useState<"user" | "system">("system");

  const handleSaveToken = async () => {
    if (!newToken.trim()) return;
    setSavingToken(true);
    try {
      await metaApi("setupToken", { token: newToken.trim(), permanent: tokenMode === "system" });
      setNewToken("");
      setTokenExpired(false);
      loadCampaigns();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingToken(false);
    }
  };

  const selectCampaign = async (c: MetaCampaign) => {
    setLoading(true); setError(null);
    try { setMetaAdSets(await metaApi("getAdSets", { campaignId: c.id })); setStep("adsets"); }
    catch (e: any) { setError(e.message); if (isExpiredError(e.message)) setTokenExpired(true); }
    finally { setLoading(false); }
  };

  const selectAdSet = async (adSet: MetaAdSet) => {
    setSelectedAdSet(adSet); setLoading(true); setError(null);
    try {
      const ads: MetaAd[] = await metaApi("getAds", { adSetId: adSet.id });
      const fresh = ads.filter((a) => !existingMetaIds.has(a.id));
      setMetaAds(fresh); setSelected(new Set(fresh.map((a) => a.id))); setStep("ads");
    } catch (e: any) { setError(e.message); if (isExpiredError(e.message)) setTokenExpired(true); }
    finally { setLoading(false); }
  };

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleImport = async () => {
    setImporting(true);
    try {
      for (const a of metaAds.filter((a) => selected.has(a.id))) {
        await insertAd(campaignId, {
          name: a.name, metaAdId: a.id,
          metaAdsetId: selectedAdSet?.id ?? null, metaAdsetName: selectedAdSet?.name ?? null,
          concept: "Advertorial", format: "Native Image", awareness: "Problem aware",
          desire: "", angle: "", notes: "", testFocus: "desire", status: "testing", duration: 7,
        });
      }
      onImported(); onClose();
    } catch (e: any) { setError(e.message); } finally { setImporting(false); }
  };

  const stepTitle = step === "campaigns" ? "📥 Import from Meta" : step === "adsets" ? "Select Ad Set" : "Select Ads";
  const stepSub   = step === "campaigns" ? "Pick a campaign" : step === "adsets" ? "Pick an ad set" : `${selected.size} of ${metaAds.length} selected`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[rgba(14,14,22,0.98)] border border-sky-500/20 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div><h2 className="text-sm font-semibold text-zinc-100">{stepTitle}</h2><p className="text-[11px] text-zinc-500 mt-0.5">{stepSub}</p></div>
          <div className="flex items-center gap-2">
            {step !== "campaigns" && <button onClick={() => setStep(step === "ads" ? "adsets" : "campaigns")} className="px-3 py-1.5 rounded-lg text-xs border border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 transition-all">← Back</button>}
            <button onClick={onClose} className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200 flex items-center justify-center text-sm transition-all">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && !tokenExpired && <p className="text-xs text-red-400 mb-3">⚠ {error}</p>}

          {/* Token expired — recovery UI */}
          {tokenExpired && (
            <div className="mb-4 space-y-3">
              <p className="text-xs font-semibold text-red-400">🔑 Meta token expired</p>

              {/* Mode toggle */}
              <div className="flex rounded-lg border border-white/[0.08] overflow-hidden text-xs">
                <button
                  onClick={() => setTokenMode("system")}
                  className={`flex-1 py-2 font-medium transition-all ${tokenMode === "system" ? "bg-emerald-600/20 text-emerald-300 border-r border-emerald-500/20" : "text-zinc-500 hover:text-zinc-300 border-r border-white/[0.08]"}`}
                >
                  ✅ Never expires (recommended)
                </button>
                <button
                  onClick={() => setTokenMode("user")}
                  className={`flex-1 py-2 font-medium transition-all ${tokenMode === "user" ? "bg-white/[0.06] text-zinc-200" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  ⏱ 60-day token
                </button>
              </div>

              {tokenMode === "system" ? (
                <div className="p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] space-y-2">
                  <p className="text-[11px] text-zinc-300 font-medium">System User Token — works exactly like n8n, never expires</p>
                  <ol className="text-[11px] text-zinc-400 space-y-1 list-decimal list-inside leading-relaxed">
                    <li>Go to <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">business.facebook.com → System Users</a></li>
                    <li>Click <span className="text-zinc-200">+ Add</span> → name it anything → role: <span className="text-zinc-200">Admin</span></li>
                    <li>Click <span className="text-zinc-200">Generate New Token</span> → select your app</li>
                    <li>Add permissions: <span className="font-mono text-[10px] text-zinc-200">ads_read</span>, <span className="font-mono text-[10px] text-zinc-200">read_insights</span></li>
                    <li>Copy the token and paste below</li>
                  </ol>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Get a short-lived token from{" "}
                    <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Graph API Explorer</a>
                    {" "}with <span className="font-mono text-[10px] text-zinc-200">ads_read</span> + <span className="font-mono text-[10px] text-zinc-200">read_insights</span>.
                    We&apos;ll exchange it for 60 days and auto-extend before expiry.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="EAAxxxxx..."
                  className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-sky-500/40 font-mono"
                />
                <button
                  onClick={handleSaveToken}
                  disabled={!newToken.trim() || savingToken}
                  className="px-4 py-2 rounded-lg bg-sky-600 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  {savingToken ? "Saving…" : "Save & retry"}
                </button>
              </div>
            </div>
          )}

          {loading ? <div className="flex items-center justify-center py-12 text-zinc-600 text-sm">Loading…</div>
          : step === "campaigns" ? (
            <div className="space-y-1">
              {metaCampaigns.length === 0 && <p className="text-zinc-600 text-sm text-center py-8">No campaigns found.</p>}
              {metaCampaigns.map((c) => (
                <button key={c.id} onClick={() => selectCampaign(c)} className="w-full text-left px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-sky-500/30 transition-all group">
                  <p className="text-sm text-zinc-200 group-hover:text-white">{c.name}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wider">{c.status}{c.objective ? ` · ${c.objective}` : ""}</p>
                </button>
              ))}
            </div>
          ) : step === "adsets" ? (
            <div className="space-y-1">
              {metaAdSets.length === 0 && <p className="text-zinc-600 text-sm text-center py-8">No ad sets found.</p>}
              {metaAdSets.map((s) => (
                <button key={s.id} onClick={() => selectAdSet(s)} className="w-full text-left px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-sky-500/30 transition-all group">
                  <p className="text-sm text-zinc-200 group-hover:text-white">{s.name}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wider">{s.status}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {metaAds.length === 0 && <p className="text-zinc-600 text-sm text-center py-8">All ads already imported.</p>}
              {metaAds.map((a) => (
                <button key={a.id} onClick={() => toggle(a.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${selected.has(a.id) ? "border-sky-500/30 bg-sky-500/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[10px] ${selected.has(a.id) ? "bg-sky-500 border-sky-400 text-white" : "border-white/20"}`}>{selected.has(a.id) && "✓"}</span>
                  <div><p className="text-sm text-zinc-200">{a.name}</p><p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-0.5">{a.status}</p></div>
                </button>
              ))}
            </div>
          )}
        </div>
        {step === "ads" && metaAds.length > 0 && (
          <div className="px-6 py-4 border-t border-white/[0.06] flex gap-2 shrink-0">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] text-sm text-zinc-400 hover:text-zinc-200 transition-all">Cancel</button>
            <button onClick={handleImport} disabled={importing || selected.size === 0}
              className="flex-1 py-2.5 rounded-xl bg-sky-600 text-sm font-medium hover:bg-sky-500 disabled:opacity-50 transition-colors text-white">
              {importing ? "Importing…" : `Import ${selected.size} Ad${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Test Matrix ────────────────────────────────────────────── */

function MatrixCell({ ads }: { ads: Ad[] }) {
  if (ads.length === 0) return <span className="text-zinc-700 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      {ads.map((a) => <span key={a.id} className={`w-2.5 h-2.5 rounded-full ${STATUS[a.status].dot}`} title={`${a.name} · ${a.status}`} />)}
    </div>
  );
}

function TestMatrix({ ads }: { ads: Ad[] }) {
  const usedFormats      = [...new Set(ads.map((a) => a.format))].filter(Boolean) as FormatType[];
  const testedConcepts   = CONCEPTS.filter((c) => ads.some((a) => a.concept === c));
  const untestedConcepts = CONCEPTS.filter((c) => !ads.some((a) => a.concept === c));
  if (usedFormats.length === 0) return null;
  return (
    <div className="border border-white/[0.06] bg-white/[0.02] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.05] bg-white/[0.01]">
              <th className="text-left px-4 py-2.5 text-zinc-500 font-medium min-w-[160px]">Concept</th>
              {usedFormats.map((f) => <th key={f} className="px-4 py-2.5 text-zinc-500 font-medium text-center whitespace-nowrap">{f}</th>)}
            </tr>
          </thead>
          <tbody>
            {testedConcepts.map((concept, i) => (
              <tr key={concept} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="px-4 py-2.5 text-zinc-300 text-xs">{conceptEmojis[concept]} {concept}</td>
                {usedFormats.map((format) => (
                  <td key={format} className="px-4 py-2.5 text-center">
                    <MatrixCell ads={ads.filter((a) => a.concept === concept && a.format === format)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/[0.05] px-4 py-2.5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />Testing</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Winner</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Loser</span>
        </div>
        {untestedConcepts.length > 0 && (
          <><span className="hidden sm:block text-white/[0.06]">|</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Not tested:</span>
            {untestedConcepts.map((c) => (
              <span key={c} className="text-[10px] text-zinc-700 border border-white/[0.05] rounded-md px-2 py-0.5">{conceptEmojis[c]} {c}</span>
            ))}
          </div></>
        )}
      </div>
    </div>
  );
}

/* ─── Analyze Modal ──────────────────────────────────────────── */

function AnalyzeModal({ campaign, ads, onClose }: { campaign: Campaign; ads: Ad[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = generateAnalysisText(campaign, ads);
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[rgba(14,14,22,0.98)] border border-violet-500/20 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div><h2 className="text-sm font-semibold text-zinc-100">Analyze with Claude</h2><p className="text-[11px] text-zinc-500 mt-0.5">Copy → paste into claude.ai → get insights</p></div>
          <div className="flex items-center gap-2">
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-all">Open Claude.ai ↗</a>
            <button onClick={copy} className={`px-3 py-1.5 rounded-lg text-xs border transition-all font-medium ${copied ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"}`}>{copied ? "✓ Copied!" : "Copy"}</button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200 flex items-center justify-center text-sm transition-all">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <pre className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">{text}</pre>
        </div>
      </div>
    </div>
  );
}

/* ─── Ad Form Modal ──────────────────────────────────────────── */

function AdFormModal({ editing, onClose, onSave }: {
  editing: Ad | null; onClose: () => void; onSave: (data: Partial<Ad>) => Promise<void>;
}) {
  const [concept,      setConcept]      = useState<ConceptType>(editing?.concept      ?? "Advertorial");
  const [format,       setFormat]       = useState(editing?.format       ?? "Native Image");
  const [awareness,    setAwareness]    = useState(editing?.awareness    ?? "Problem aware");
  const [name,         setName]         = useState(editing?.name         ?? "");
  const [massDesire,   setMassDesire]   = useState(editing?.massDesire   ?? "");
  const [pricingOffer, setPricingOffer] = useState(editing?.pricingOffer ?? "");
  const [hook,         setHook]         = useState(editing?.desire       ?? "");
  const [notes,        setNotes]        = useState(editing?.notes        ?? "");
  const [duration,     setDuration]     = useState(editing?.duration     ?? 7);
  const [saving,       setSaving]       = useState(false);
  const autoName = `${concept} · ${format}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ concept, format: format as FormatType, awareness: awareness as Ad["awareness"],
        name: name.trim() || autoName, massDesire: massDesire.trim(), pricingOffer: pricingOffer.trim(),
        desire: hook.trim(), angle: "", notes: notes.trim(), duration, targetAvatar: "", testFocus: "desire" });
    } catch (err: any) { alert(err?.message ?? "Failed to save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[rgba(14,14,22,0.98)] border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/[0.06] shrink-0"><h2 className="text-base font-semibold text-zinc-100">{editing ? "Edit Ad" : "New Ad Test"}</h2></div>
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Concept <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-1.5">
              {CONCEPTS.map((c) => <button key={c} onClick={() => setConcept(c)} className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${concept === c ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300" : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}>{conceptEmojis[c]} {c}</button>)}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Format <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => <button key={f} onClick={() => setFormat(f)} className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${format === f ? "bg-violet-600/30 border-violet-500/50 text-violet-300" : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}>{f}</button>)}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Awareness Level <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-1.5">
              {AWARENESS_TEST_LEVELS.map((a) => <button key={a} onClick={() => setAwareness(a)} className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${awareness === a ? "bg-yellow-600/20 border-yellow-500/40 text-yellow-300" : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}>{a}</button>)}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-orange-400/80 uppercase tracking-wider block mb-2">Mass Desire</label>
            <textarea value={massDesire} onChange={(e) => setMassDesire(e.target.value)} placeholder="What core desire, fear, or aspiration does this ad tap into?" rows={3} className="w-full bg-orange-500/[0.04] border border-orange-500/20 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-orange-500/30 resize-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-emerald-400/80 uppercase tracking-wider block mb-2">Pricing / Offer</label>
            <input value={pricingOffer} onChange={(e) => setPricingOffer(e.target.value)} placeholder="e.g. Buy 2 get 1 free · $79 · Free shipping" className="w-full bg-emerald-500/[0.04] border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Label <span className="text-zinc-600 font-normal normal-case">(optional — auto: "{autoName}")</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={autoName} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] transition-all" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Hook / Angle <span className="text-zinc-600 font-normal normal-case">(optional)</span></label>
            <textarea value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Specific hook, opening line, or angle you're testing" rows={2} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] resize-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Notes / Learnings <span className="text-zinc-600 font-normal normal-case">(optional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you observe or learn from this test?" rows={2} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] resize-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Test Duration</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map((d) => <button key={d} onClick={() => setDuration(d)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${duration === d ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300" : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}>{d}d</button>)}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] text-sm text-zinc-400 hover:text-zinc-200 transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors text-white">{saving ? "Saving…" : editing ? "Save Changes" : "Add Test"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Ad Table Row ───────────────────────────────────────────── */

function AdRow({ ad, onStatusChange, onEdit, onDelete }: {
  ad: Ad; onStatusChange: (id: string, s: Ad["status"]) => void;
  onEdit: (ad: Ad) => void; onDelete: (id: string) => void;
}) {
  const sc = STATUS[ad.status];
  const { daysPassed, done, percent } = getProgress(ad);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ins = ad.metaInsights;

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      <td className="pl-4 pr-3 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded border ${sc.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} shrink-0`} />{sc.label}
        </span>
      </td>
      <td className="px-3 py-3 min-w-[160px] max-w-[260px]">
        <p className="text-sm text-zinc-200 font-medium leading-tight truncate">{ad.name}</p>
        {ad.metaAdsetName && <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{ad.metaAdsetName}</p>}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="text-[11px] text-zinc-300">{conceptEmojis[ad.concept ?? "Other"]} {ad.concept ?? "—"}</span>
      </td>
      <td className="px-3 py-3 whitespace-nowrap"><span className="text-[11px] text-zinc-400">{ad.format}</span></td>
      <td className="px-3 py-3 whitespace-nowrap"><span className="text-[11px] text-yellow-400/80">{ad.awareness}</span></td>
      <td className="px-3 py-3 whitespace-nowrap"><span className="text-[11px] text-zinc-500 capitalize">{ad.testFocus}</span></td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins ? fmtN(ins.reach)              : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins ? fmtN(ins.impressions)        : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins?.ctrAll ? fmtCtr(ins.ctrAll)   : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins ? fmtCtr(ins.ctr)              : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins ? fmtN(ins.linkClicks)         : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins?.landingPageViews ? fmtN(ins.landingPageViews) : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins ? fmtDollar(ins.spend)         : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins?.costPerClick  ? fmtDollar(ins.costPerClick)  : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 text-right text-[12px] text-zinc-300 tabular-nums">{ins?.costPerResult ? fmtDollar(ins.costPerResult) : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3 whitespace-nowrap min-w-[90px]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">{daysPassed}/{ad.duration}d</span>
          <div className="w-10 h-1 bg-white/[0.06] rounded-full overflow-hidden shrink-0">
            <div className={`h-full rounded-full ${done ? "bg-emerald-500/50" : sc.bar + "/50"}`} style={{ width: `${percent}%` }} />
          </div>
        </div>
      </td>
      <td className="pr-4 pl-2 py-3 whitespace-nowrap">
        <div className="flex items-center gap-0.5">
          {(["winner", "loser", "testing"] as Ad["status"][]).map((s) => (
            <button key={s} onClick={() => onStatusChange(ad.id, s)} title={s}
              className={`w-6 h-6 rounded text-[10px] font-bold border transition-colors ${
                ad.status === s
                  ? s === "winner" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                  : s === "loser"  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  :                  "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                  : "border-white/[0.05] bg-transparent text-zinc-700 hover:text-zinc-300 hover:border-white/[0.12]"
              }`}>
              {s === "winner" ? "W" : s === "loser" ? "L" : "T"}
            </button>
          ))}
          <button onClick={() => onEdit(ad)} title="Edit" className="w-6 h-6 rounded text-[11px] border border-white/[0.05] bg-transparent text-zinc-600 hover:text-zinc-200 transition-colors ml-0.5">✎</button>
          <button
            onClick={() => { if (confirmDelete) onDelete(ad.id); else setConfirmDelete(true); }}
            onBlur={() => setTimeout(() => setConfirmDelete(false), 200)}
            className={`w-6 h-6 rounded text-[10px] border transition-colors ${confirmDelete ? "bg-red-500/20 border-red-500/30 text-red-300" : "border-white/[0.05] bg-transparent text-zinc-700 hover:text-red-400 hover:border-red-500/20"}`}>
            {confirmDelete ? "?" : "✕"}
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Ad Set Table Row ───────────────────────────────────────── */

function AdSetRow({ name, ads, onClick }: { name: string; ads: Ad[]; onClick: () => void }) {
  const testing = ads.filter((a) => a.status === "testing").length;
  const winners = ads.filter((a) => a.status === "winner").length;
  const losers  = ads.filter((a) => a.status === "loser").length;
  const withIns     = ads.filter((a) => a.metaInsights);
  const reach       = withIns.reduce((s, a) => s + parseFloat(a.metaInsights!.reach       || "0"), 0);
  const impressions = withIns.reduce((s, a) => s + parseFloat(a.metaInsights!.impressions || "0"), 0);
  const clicks      = withIns.reduce((s, a) => s + parseFloat(a.metaInsights!.linkClicks  || "0"), 0);
  const lpViews     = withIns.reduce((s, a) => s + parseFloat(a.metaInsights!.landingPageViews || "0"), 0);
  const spend       = withIns.reduce((s, a) => s + parseFloat(a.metaInsights!.spend       || "0"), 0);
  const avgCtr      = withIns.length > 0
    ? withIns.reduce((s, a) => s + parseFloat(a.metaInsights!.ctr || "0"), 0) / withIns.length : null;
  const cpcAds      = withIns.filter((a) => a.metaInsights?.costPerClick);
  const avgCpc      = cpcAds.length > 0
    ? cpcAds.reduce((s, a) => s + parseFloat(a.metaInsights!.costPerClick! || "0"), 0) / cpcAds.length : null;

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors group" onClick={onClick}>
      <td className="pl-4 pr-3 py-3.5 min-w-[200px]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200 font-medium group-hover:text-white transition-colors">{name}</span>
          <span className="text-[10px] text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">View ads →</span>
        </div>
      </td>
      <td className="px-3 py-3.5 text-right"><span className="text-[12px] text-zinc-400">{ads.length}</span></td>
      <td className="px-3 py-3.5">
        <div className="flex items-center gap-2 text-[11px]">
          {testing > 0 && <span className="text-indigo-400">{testing}T</span>}
          {winners > 0 && <span className="text-emerald-400">{winners}W</span>}
          {losers  > 0 && <span className="text-red-400">{losers}L</span>}
        </div>
      </td>
      <td className="px-3 py-3.5 text-right text-[12px] text-zinc-300 tabular-nums">{reach > 0 ? fmtN(String(Math.round(reach))) : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3.5 text-right text-[12px] text-zinc-300 tabular-nums">{impressions > 0 ? fmtN(String(Math.round(impressions))) : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3.5 text-right text-[12px] text-zinc-300 tabular-nums">{avgCtr !== null ? `${avgCtr.toFixed(2)}%` : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3.5 text-right text-[12px] text-zinc-300 tabular-nums">{clicks > 0 ? fmtN(String(Math.round(clicks))) : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3.5 text-right text-[12px] text-zinc-300 tabular-nums">{lpViews > 0 ? fmtN(String(Math.round(lpViews))) : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3.5 text-right text-[12px] text-zinc-300 tabular-nums">{spend > 0 ? `$${spend.toFixed(2)}` : <span className="text-zinc-700">—</span>}</td>
      <td className="px-3 py-3.5 text-right text-[12px] text-zinc-300 tabular-nums pr-4">{avgCpc !== null ? `$${avgCpc.toFixed(2)}` : <span className="text-zinc-700">—</span>}</td>
    </tr>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function CampaignPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [campaign,      setCampaign]      = useState<Campaign | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [editingAd,     setEditingAd]     = useState<Ad | null>(null);
  const [showMatrix,    setShowMatrix]    = useState(true);
  const [showAnalyze,   setShowAnalyze]   = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [syncingMeta,   setSyncingMeta]   = useState(false);
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("all");
  const [conceptFilter, setConceptFilter] = useState<ConceptType | "all">("all");
  const [formatFilter,  setFormatFilter]  = useState<FormatType | "all">("all");
  const [level,         setLevel]         = useState<Level>("ads");
  const [datePreset,    setDatePreset]    = useState<DatePreset>("last_30d");
  const [customSince,   setCustomSince]   = useState("");
  const [customUntil,   setCustomUntil]   = useState("");
  const [adsetFilter,   setAdsetFilter]   = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      const c = await fetchCampaignWithAds(id);
      setCampaign(c);
      return c;
    } catch (err: any) {
      setError(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const syncMeta = useCallback(async (
    overrideCampaign?: Campaign,
    overridePreset?: DatePreset,
    since?: string,
    until?: string,
  ) => {
    const source = overrideCampaign ?? campaign;
    const preset = overridePreset  ?? datePreset;
    if (!source) return;
    const adsWithMeta = source.ads.filter((a) => a.metaAdId);
    if (!adsWithMeta.length) return;
    setSyncingMeta(true);
    try {
      const adIds = adsWithMeta.map((a) => a.metaAdId as string);
      const insightParams: Record<string, any> = { adIds };
      if (preset === "custom" && since && until) {
        insightParams.since = since;
        insightParams.until = until;
      } else {
        insightParams.datePreset = preset;
      }
      const insights = await metaApi("syncInsights", insightParams);
      await Promise.all(
        adsWithMeta.map(async (a) => {
          const data = insights[a.metaAdId as string];
          if (data) await updateAdMetaInsights(a.id, data as MetaInsights);
        })
      );
      await load();
    } catch (e: any) {
      console.error("Meta sync failed:", e.message);
    } finally {
      setSyncingMeta(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, datePreset]);

  useEffect(() => {
    load().then((c) => {
      if (!c) return;
      const needsSync = c.ads.some((a) => a.metaAdId && !a.metaInsights);
      if (needsSync) syncMeta(c);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDateSelect = async (preset: DatePreset, since?: string, until?: string) => {
    setDatePreset(preset);
    if (preset === "custom" && since && until) {
      setCustomSince(since);
      setCustomUntil(until);
    }
    await syncMeta(undefined, preset, since, until);
  };

  const openNew   = () => { setEditingAd(null); setShowForm(true); };
  const openEdit  = (ad: Ad) => { setEditingAd(ad); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingAd(null); };

  const handleSave = async (data: Partial<Ad>) => {
    if (editingAd) {
      await updateAd({ ...editingAd, ...data } as Ad);
    } else {
      await insertAd(id, {
        name: data.name!, concept: data.concept,
        massDesire: data.massDesire ?? "", pricingOffer: data.pricingOffer ?? "",
        desire: data.desire ?? "", angle: data.angle ?? "",
        awareness: data.awareness ?? "Problem aware",
        targetAvatar: data.targetAvatar ?? "", notes: data.notes ?? "",
        format: data.format!, testFocus: data.testFocus ?? "desire",
        status: "testing", duration: data.duration ?? 7,
      });
    }
    await load();
    closeForm();
  };

  const handleStatusChange = async (adId: string, status: Ad["status"]) => {
    await setAdStatus(adId, status);
    await load();
  };

  const handleDelete = async (adId: string) => {
    await deleteAdWithVariants(adId);
    await load();
  };

  /* ─── derived data ── */
  const allAds = campaign?.ads ?? [];

  const adSets = useMemo(() => {
    const map = new Map<string, { id: string; name: string; ads: Ad[] }>();
    for (const ad of allAds) {
      if (!ad.metaAdsetId) continue;
      if (!map.has(ad.metaAdsetId)) map.set(ad.metaAdsetId, { id: ad.metaAdsetId, name: ad.metaAdsetName ?? ad.metaAdsetId, ads: [] });
      map.get(ad.metaAdsetId)!.ads.push(ad);
    }
    return Array.from(map.values());
  }, [allAds]);

  const filteredAds = useMemo(() => allAds.filter((a) => {
    if (statusFilter  !== "all" && a.status  !== statusFilter)  return false;
    if (conceptFilter !== "all" && a.concept !== conceptFilter) return false;
    if (formatFilter  !== "all" && a.format  !== formatFilter)  return false;
    if (adsetFilter   !== null  && a.metaAdsetId !== adsetFilter) return false;
    return true;
  }), [allAds, statusFilter, conceptFilter, formatFilter, adsetFilter]);

  const testing = allAds.filter((a) => a.status === "testing").length;
  const winners = allAds.filter((a) => a.status === "winner").length;
  const losers  = allAds.filter((a) => a.status === "loser").length;
  const usedConcepts = [...new Set(allAds.map((a) => a.concept).filter(Boolean))] as ConceptType[];
  const usedFormats  = [...new Set(allAds.map((a) => a.format).filter(Boolean))]  as FormatType[];

  /* ─── render guards ── */
  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>;
  if (error)   return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center"><p className="text-red-400 text-sm mb-3">{error}</p><Link href="/ads" className="text-indigo-400 text-sm hover:underline">← Back</Link></div>
    </div>
  );
  if (!campaign) return null;

  const metricTh = "px-3 py-2.5 text-right text-[10px] font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap";
  const labelTh  = "px-3 py-2.5 text-left  text-[10px] font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap";

  return (
    <div className="min-h-screen bg-zinc-950">
      {showForm    && <AdFormModal editing={editingAd} onClose={closeForm} onSave={handleSave} />}
      {showAnalyze && <AnalyzeModal campaign={campaign} ads={allAds} onClose={() => setShowAnalyze(false)} />}
      {showImport  && (
        <MetaImportModal
          campaignId={id}
          existingMetaIds={new Set(allAds.map((a) => a.metaAdId).filter(Boolean) as string[])}
          onClose={() => setShowImport(false)}
          onImported={async () => { const fresh = await load(); if (fresh) await syncMeta(fresh); }}
        />
      )}

      {/* ─── Header (sticky) — breadcrumb + actions only ── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-[rgba(7,7,15,0.92)] backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/ads" className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">← Campaigns</Link>
            <span className="text-zinc-700 shrink-0">/</span>
            <h1 className="text-sm font-semibold text-zinc-100 truncate">{campaign.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {allAds.some((a) => a.metaAdId) && (
              <button onClick={() => syncMeta()} disabled={syncingMeta}
                className="px-3 py-1.5 rounded-lg text-xs border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-all font-medium disabled:opacity-40">
                {syncingMeta ? "Syncing…" : "↻ Sync"}
              </button>
            )}
            <button onClick={() => setShowImport(true)} className="px-3 py-1.5 rounded-lg text-xs border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all">📥 Import</button>
            {allAds.length > 0 && (
              <button onClick={() => setShowAnalyze(true)} className="px-3 py-1.5 rounded-lg text-xs border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all">🤖 Analyze</button>
            )}
            <button onClick={openNew} className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-sm font-medium hover:bg-indigo-500 transition-colors text-white">+ New Test</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-5 py-5 space-y-5">

        {/* Stats strip */}
        <div className="flex items-center gap-5 text-sm">
          <span className="text-zinc-500">{allAds.length} total</span>
          <span className="flex items-center gap-1.5 text-indigo-400"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />{testing} testing</span>
          <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />{winners} winner{winners !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1.5 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />{losers} loser{losers !== 1 ? "s" : ""}</span>
        </div>

        {/* Test Matrix (collapsible) */}
        {allAds.length > 0 && (
          <div>
            <button onClick={() => setShowMatrix(!showMatrix)}
              className="flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2 uppercase tracking-wider font-medium">
              <span className="text-zinc-700">{showMatrix ? "▼" : "▶"}</span>
              Test Matrix
            </button>
            {showMatrix && <TestMatrix ads={allAds} />}
          </div>
        )}

        {/* ─── Level tabs + date filter bar ── */}
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-0">
          {/* Tabs */}
          <div className="flex items-center gap-0">
            {/* Campaigns tab — navigates back */}
            <button
              onClick={() => router.push("/ads")}
              className="px-4 py-2.5 text-xs font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-300 transition-all -mb-px"
            >
              Campaigns
            </button>
            <button
              onClick={() => { setLevel("adsets"); setAdsetFilter(null); }}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
                level === "adsets" ? "border-indigo-400 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Ad Sets{adSets.length > 0 && <span className="ml-1.5 text-[10px] text-zinc-600">{adSets.length}</span>}
            </button>
            <button
              onClick={() => setLevel("ads")}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
                level === "ads" ? "border-indigo-400 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Ads{allAds.length > 0 && <span className="ml-1.5 text-[10px] text-zinc-600">{allAds.length}</span>}
            </button>
          </div>

          {/* Date filter */}
          <div className="pb-1.5">
            <DateFilter
              value={datePreset}
              customSince={customSince}
              customUntil={customUntil}
              loading={syncingMeta}
              onSelect={handleDateSelect}
            />
          </div>
        </div>

        {/* ── AD SETS LEVEL ── */}
        {level === "adsets" && (
          adSets.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <p className="text-3xl mb-3">📂</p>
              <p className="text-sm">No ad sets yet. Import ads from Meta to see ad set groupings.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.015]">
                    <th className={labelTh  + " pl-4"}>Ad Set</th>
                    <th className={metricTh}>Ads</th>
                    <th className={labelTh}>Status</th>
                    <th className={metricTh}>Reach</th>
                    <th className={metricTh}>Imp</th>
                    <th className={metricTh}>CTR Link</th>
                    <th className={metricTh}>Clicks</th>
                    <th className={metricTh}>LP Views</th>
                    <th className={metricTh}>Spend</th>
                    <th className={metricTh + " pr-4"}>CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {adSets.map((as) => (
                    <AdSetRow key={as.id} name={as.name} ads={as.ads}
                      onClick={() => { setAdsetFilter(as.id); setLevel("ads"); }} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── ADS LEVEL ── */}
        {level === "ads" && (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {adsetFilter !== null && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-sky-500/30 bg-sky-500/10 text-sky-300">
                  {adSets.find((as) => as.id === adsetFilter)?.name ?? "Ad Set"}
                  <button onClick={() => setAdsetFilter(null)} className="text-sky-500 hover:text-white transition-colors">✕</button>
                </span>
              )}
              {(["all", "testing", "winner", "loser"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${statusFilter === s ? "bg-white/10 border-white/20 text-white" : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"}`}>
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              {usedConcepts.length > 1 && (
                <><span className="w-px h-4 bg-white/[0.08]" />
                <select value={conceptFilter} onChange={(e) => setConceptFilter(e.target.value as ConceptType | "all")}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-white/[0.18] transition-all">
                  <option value="all">All concepts</option>
                  {usedConcepts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></>
              )}
              {usedFormats.length > 1 && (
                <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value as FormatType | "all")}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-white/[0.18] transition-all">
                  <option value="all">All formats</option>
                  {usedFormats.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
            </div>

            {/* Ads table */}
            {filteredAds.length === 0 ? (
              <div className="text-center py-20 text-zinc-600">
                {allAds.length === 0
                  ? <><p className="text-4xl mb-3">🧪</p><p className="text-sm">No tests yet. Hit "+ New Test" to start tracking.</p></>
                  : <p className="text-sm">No ads match the current filters.</p>}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.015]">
                      <th className={labelTh + " pl-4"}>Status</th>
                      <th className={labelTh}>Name</th>
                      <th className={labelTh}>Concept</th>
                      <th className={labelTh}>Format</th>
                      <th className={labelTh}>Awareness</th>
                      <th className={labelTh}>Focus</th>
                      <th className={metricTh}>Reach</th>
                      <th className={metricTh}>Imp</th>
                      <th className={metricTh}>CTR</th>
                      <th className={metricTh}>CTR Link</th>
                      <th className={metricTh}>Clicks</th>
                      <th className={metricTh}>LP Views</th>
                      <th className={metricTh}>Spend</th>
                      <th className={metricTh}>CPC</th>
                      <th className={metricTh}>CPR</th>
                      <th className={labelTh}>Days</th>
                      <th className={labelTh}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAds.map((ad) => (
                      <AdRow key={ad.id} ad={ad} onStatusChange={handleStatusChange} onEdit={openEdit} onDelete={handleDelete} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
