"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, MouseEvent } from "react";
import { Campaign, NICHES, Niche, nicheEmojis } from "@/types/ads";
import { getCampaigns, saveCampaigns, deleteCampaign } from "@/lib/ads-storage";
import Link from "next/link";

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState<Niche>("Health");
  const [filter, setFilter] = useState<Niche | "All">("All");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await getCampaigns();
        if (!cancelled) {
          setCampaigns(data);
          setMounted(true);
        }
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err?.message || "Failed to load campaigns");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (!mounted) return <div className="min-h-screen" />;

  const filtered = filter === "All" ? campaigns : campaigns.filter((c) => c.niche === filter);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setErrorMsg(null);
    const temp: Campaign = { id: "temp", name: trimmed, niche, ads: [], createdAt: new Date().toISOString() };
    const optimistic = [...campaigns, temp];
    setCampaigns(optimistic);
    setShowNew(false);
    setName("");
    try {
      const updated = await saveCampaigns(optimistic);
      setCampaigns(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save campaign");
      setCampaigns(campaigns);
    }
  };

  const remove = async (id: string, e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!window.confirm("Delete this campaign?")) return;
    setErrorMsg(null);
    try {
      await deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete campaign");
    }
  };

  return (
    <div className="min-h-screen px-4 sm:px-8 pt-8 sm:pt-10 pb-20">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-3">Ads</p>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-100 tracking-tight">🎯 Ad Tracker</h1>
          </div>
          <button
            onClick={() => setShowNew(true)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            + New Campaign
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
            {errorMsg}
          </div>
        )}

        {/* Niche filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilter("All")}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${filter === "All" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
          >
            All
          </button>
          {NICHES.map((n) => (
            <button
              key={n}
              onClick={() => setFilter(filter === n ? "All" : n)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${filter === n ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
            >
              {nicheEmojis[n]} {n}
            </button>
          ))}
        </div>

        {/* New campaign modal */}
        {showNew && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-sm">
              <h2 className="font-bold mb-4">New Campaign</h2>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Campaign name"
                onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-3 gap-2 mb-4">
                {NICHES.map((n) => (
                  <button
                    key={n}
                    onClick={() => setNiche(n)}
                    className={`px-2 py-1.5 rounded-lg text-xs border ${niche === n ? "bg-blue-600 border-blue-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
                  >
                    {nicheEmojis[n]} {n}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-400">Cancel</button>
                <button onClick={create} disabled={!name.trim()} className="flex-1 py-2 rounded-lg bg-blue-600 text-sm font-medium disabled:opacity-50">Create</button>
              </div>
            </div>
          </div>
        )}

        {/* Campaign list */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-4xl mb-3">📊</p>
            <p>{loading ? "Loading campaigns…" : "No campaigns yet"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const ads = c.ads || [];
              const winners = ads.filter((a) => a.status === "winner").length;
              const testing = ads.filter((a) => a.status === "testing").length;
              return (
                <Link
                  key={c.id}
                  href={`/ads/campaign/${c.id}`}
                  className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 hover:border-zinc-600 transition-all group"
                >
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">{nicheEmojis[c.niche]} {c.niche}</div>
                    <div className="font-semibold group-hover:text-blue-400 transition-colors">{c.name}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs text-zinc-500">
                      <div>{ads.length} ads</div>
                      {winners > 0 && <div className="text-green-400">{winners} winners</div>}
                      {testing > 0 && <div className="text-blue-400">{testing} testing</div>}
                    </div>
                    <button
                      onClick={(e) => remove(c.id, e)}
                      className="text-zinc-600 hover:text-red-400 text-sm transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
