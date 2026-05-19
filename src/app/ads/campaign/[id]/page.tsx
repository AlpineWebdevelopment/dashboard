"use client";

export const dynamic = "force-dynamic";
import { fetchAdCopies } from "@/lib/ads-storage";

import { useState, useEffect, Fragment, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Campaign, Ad, AwarenessLevel, TestFocus, FormatType,
  CboWave, CboPhase, CboFolder, CboItemCopy
} from "@/types/ads";
import {
  fetchCampaignWithAds, insertAd, updateAd, setAdStatus,
  deleteAdWithVariants, deleteSingleAd, fetchWaves, createWave,
  updatePhase, deleteWave, updateWaveStatus, fetchFolders,
} from "@/lib/ads-storage";
import Link from "next/link";

/* ─────────────────────── Constants ─────────────────────── */

const AWARENESS_OPTIONS: AwarenessLevel[] = [
  "Unaware","Problem aware","Solution aware","Product aware","Most aware","Other",
];
const TEST_FOCUS_OPTIONS: { id: TestFocus; label: string; color: string }[] = [
  { id: "desire", label: "Desire", color: "border-orange-500 bg-orange-500/15" },
  { id: "angle", label: "Angle", color: "border-amber-500 bg-amber-500/15" },
  { id: "awareness", label: "Awareness", color: "border-yellow-500 bg-yellow-500/15" },
  { id: "advertorial", label: "Advertorial", color: "border-emerald-500 bg-emerald-500/15" },
  { id: "format", label: "Format", color: "border-fuchsia-500 bg-fuchsia-500/15" },
];
const FORMAT_OPTIONS: FormatType[] = [
  "UGC","AI Vid","VSL","Slideshow","Static","Native Image","Carousel","Story","Other",
];
const DURATION_OPTIONS = [3, 5, 7, 10, 14, 21, 30];
const PHASE_LABELS: Record<string, string> = {
  desire: "🎯 Desire", angle: "📐 Angle", awareness: "👁 Awareness",
  advertorial: "📰 Advertorial", format: "🎬 Format",
};
const PHASE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  desire: { border: "border-orange-500", bg: "bg-orange-500", text: "text-orange-300" },
  angle: { border: "border-amber-500", bg: "bg-amber-500", text: "text-amber-300" },
  awareness: { border: "border-yellow-500", bg: "bg-yellow-500", text: "text-yellow-300" },
  advertorial: { border: "border-emerald-500", bg: "bg-emerald-500", text: "text-emerald-300" },
  format: { border: "border-fuchsia-500", bg: "bg-fuchsia-500", text: "text-fuchsia-300" },
};

const GROUP_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
  "#6366f1", "#a855f7", "#e11d48", "#0ea5e9", "#10b981",
  "#eab308", "#7c3aed", "#2dd4bf", "#f472b6", "#a3e635",
  "#fb923c", "#67e8f9", "#818cf8", "#c084fc", "#f43f5e",
  "#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#5eead4",
  "#f9a8d4", "#bef264", "#fdba74", "#22d3ee", "#a5b4fc",
  "#d8b4fe", "#ff6b6b", "#4ecdc4", "#ffe66d", "#95e1d3",
  "#f38181", "#aa96da", "#fcbad3", "#a8d8ea", "#ff9a9e",
  "#fad0c4", "#ffecd2", "#a1c4fd", "#c2e9fb", "#d4fc79",
];

function getAdFieldValue(ad: Ad, field: string): string {
  switch (field) {
    case "desire": return ad.desire || "";
    case "angle": return ad.angle || "";
    case "awareness": return ad.awareness || "";
    case "targetAvatar": return ad.targetAvatar || "";
    case "format": return ad.format || "";
    default: return "";
  }
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


/* ─────────────────────── Utilities ─────────────────────── */

function focusColor(f: TestFocus): string {
  switch (f) {
    case "desire": return "border-orange-500 bg-orange-500/20 text-orange-200";
    case "angle": return "border-amber-500 bg-amber-500/20 text-amber-200";
    case "awareness": return "border-yellow-500 bg-yellow-500/20 text-yellow-200";
    case "advertorial": return "border-emerald-500 bg-emerald-500/20 text-emerald-200";
    case "format": return "border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-200";
    default: return "border-zinc-700 bg-zinc-800 text-zinc-300";
  }
}

function focusDot(f: TestFocus): string {
  switch (f) {
    case "desire": return "bg-orange-500";
    case "angle": return "bg-amber-500";
    case "awareness": return "bg-yellow-500";
    case "advertorial": return "bg-emerald-500";
    case "format": return "bg-fuchsia-500";
    default: return "bg-zinc-500";
  }
}

function statusBadge(s: Ad["status"]) {
  switch (s) {
    case "winner": return { label: "🏆 Winner", cls: "bg-green-500/20 text-green-300 border-green-500/40" };
    case "loser": return { label: "✖ Loser", cls: "bg-red-500/20 text-red-300 border-red-500/40" };
    default: return { label: "⏳ Testing", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
  }
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getAdProgress(ad: Ad) {
  const start = new Date(ad.createdAt).getTime();
  const now = Date.now();
  const elapsedMs = now - start;
  const totalMs = ad.duration * 24 * 60 * 60 * 1000;
  const totalHoursElapsed = Math.floor(elapsedMs / (1000 * 60 * 60));
  const rawRemainingHours = Math.max(ad.duration * 24 - totalHoursElapsed, 0);
  const percent = Math.min(Math.round((elapsedMs / totalMs) * 100), 100);
  const daysPassed = Math.min(ad.duration, Math.floor(totalHoursElapsed / 24));
  return { daysPassed, totalHoursElapsed, hoursLeft: rawRemainingHours, percent, isComplete: rawRemainingHours === 0 };
}

/* ─────────────────────── Small components ─────────────────────── */

function MiniProgress({ ad }: { ad: Ad }) {
  const { daysPassed, hoursLeft, percent, isComplete } = getAdProgress(ad);
  const barColor = isComplete ? "bg-green-500" : percent > 66 ? "bg-yellow-500" : "bg-blue-500";
  return (
    <div className="w-full min-w-[100px]">
      <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-0.5">
        <span>Day {daysPassed}/{ad.duration}</span>
        <span>{isComplete ? <span className="text-green-400">✓</span> : `${hoursLeft}h`}</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/* ─── CBO Phase / Wave ─── */

function PhaseBlock({ phase, allAds, onUpdate }: { phase: CboPhase; allAds: Ad[]; onUpdate: (phaseId: string, status: string, winnerAds: string[], notes: string) => void }) {
  const [expanded, setExpanded] = useState(phase.status === "running");
  const [selectedWinners, setSelectedWinners] = useState<string[]>(phase.winnerAds);
  const [phaseNotes, setPhaseNotes] = useState(phase.notes);
  const [customWinner, setCustomWinner] = useState("");
  const colors = PHASE_COLORS[phase.type] || PHASE_COLORS.desire;
  const statusBg = phase.status === "done" ? "bg-green-500/20 border-green-500/40" : phase.status === "running" ? `bg-blue-500/20 ${colors.border}` : "bg-zinc-800/50 border-zinc-700";
  const toggleWinner = (adId: string) => setSelectedWinners((prev) => prev.includes(adId) ? prev.filter((id) => id !== adId) : [...prev, adId]);
  const addCustomWinner = () => { const t = customWinner.trim(); if (t && !selectedWinners.includes(t)) { setSelectedWinners((p) => [...p, t]); setCustomWinner(""); } };
  const removeWinner = (w: string) => setSelectedWinners((p) => p.filter((id) => id !== w));
  const getAdName = (id: string) => { const ad = allAds.find((a) => a.id === id); return ad ? ad.name : id; };

  return (
    <div className={`border rounded-lg p-3 ${statusBg} transition-all`}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${colors.text}`}>{PHASE_LABELS[phase.type]}</span>
          {phase.status === "done" && <span className="text-[10px] text-green-400 font-semibold">✓ Done</span>}
          {phase.status === "running" && <span className="text-[10px] text-blue-400 font-semibold animate-pulse">● Running</span>}
          {phase.status === "pending" && <span className="text-[10px] text-zinc-500">Pending</span>}
        </div>
        <div className="flex items-center gap-2">
          {phase.winnerAds.length > 0 && <span className="text-[10px] text-green-400">🏆 {phase.winnerAds.length}</span>}
          <span className="text-zinc-500 text-xs">{expanded ? "▼" : "▶"}</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            {["pending", "running", "done"].map((s) => (
              <button key={s} onClick={() => onUpdate(phase.id, s, selectedWinners, phaseNotes)}
                className={`px-3 py-1 rounded text-[11px] border ${phase.status === s ? (s === "done" ? "bg-green-600 text-white border-green-500" : s === "running" ? "bg-blue-600 text-white border-blue-500" : "bg-zinc-700 text-white border-zinc-500") : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-white"}`}>
                {s === "pending" ? "Pending" : s === "running" ? "▶ Start" : "✓ Complete"}
              </button>
            ))}
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 block mb-1">Pick winners:</span>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {allAds.map((ad) => (
                <label key={ad.id} className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer ${selectedWinners.includes(ad.id) ? "bg-green-500/15 text-green-300" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
                  <input type="checkbox" checked={selectedWinners.includes(ad.id)} onChange={() => toggleWinner(ad.id)} className="accent-green-500" />
                  {ad.name}<span className="text-[10px] text-zinc-600 ml-auto">{ad.testFocus}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 block mb-1">Or type custom:</span>
            <div className="flex gap-2">
              <input value={customWinner} onChange={(e) => setCustomWinner(e.target.value)} placeholder="Ad name or ID..." className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500" onKeyDown={(e) => { if (e.key === "Enter") addCustomWinner(); }} />
              <button onClick={addCustomWinner} className="px-3 py-1 rounded-lg bg-zinc-700 text-xs text-zinc-300 hover:text-white">Add</button>
            </div>
          </div>
          {selectedWinners.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedWinners.map((w) => (
                <span key={w} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/20 text-green-300 border border-green-500/30">
                  🏆 {getAdName(w)}<button onClick={() => removeWinner(w)} className="text-green-400 hover:text-red-400 ml-0.5">✕</button>
                </span>
              ))}
            </div>
          )}
          <textarea value={phaseNotes} onChange={(e) => setPhaseNotes(e.target.value)} placeholder="Phase notes…" rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 resize-none" />
          <button onClick={() => onUpdate(phase.id, phase.status, selectedWinners, phaseNotes)} className="w-full py-1.5 rounded-lg bg-blue-600 text-xs font-medium hover:bg-blue-500">Save Phase</button>
        </div>
      )}
    </div>
  );
}

function WaveCard({ wave, allAds, onUpdatePhase, onDeleteWave, onCompleteWave }: { wave: CboWave; allAds: Ad[]; onUpdatePhase: (pid: string, s: string, w: string[], n: string) => void; onDeleteWave: (wid: string) => void; onCompleteWave: (wid: string) => void }) {
  const [expanded, setExpanded] = useState(wave.status === "active");
  const currentPhaseIdx = wave.phases.findIndex((p) => p.status === "running");
  const nextPendingIdx = wave.phases.findIndex((p) => p.status === "pending");
  const allDone = wave.phases.every((p) => p.status === "done");
  const doneCount = wave.phases.filter((p) => p.status === "done").length;

  return (
    <div className={`border rounded-xl p-4 ${wave.status === "completed" ? "border-green-500/30 bg-green-500/5" : wave.status === "archived" ? "border-zinc-700 bg-zinc-800/30 opacity-60" : "border-zinc-700 bg-zinc-900"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setExpanded(!expanded)}>
          <span className="text-sm font-bold">{wave.name}</span>
          {wave.status === "completed" && <span className="text-[10px] text-green-400 font-semibold">✓ Completed</span>}
          <span className="text-[10px] text-zinc-500">{doneCount}/{wave.phases.length} phases done</span>
        </div>
        <div className="flex items-center gap-2">
          {allDone && wave.status === "active" && <button onClick={() => onCompleteWave(wave.id)} className="px-3 py-1 rounded text-[11px] bg-green-600 text-white hover:bg-green-500">✓ Complete Wave</button>}
          <span className="text-zinc-500 text-xs cursor-pointer" onClick={() => setExpanded(!expanded)}>{expanded ? "▼" : "▶"}</span>
        </div>
      </div>
      <div className="flex gap-1 mb-3">
        {wave.phases.map((p, i) => {
          const colors = PHASE_COLORS[p.type];
          const bg = p.status === "done" ? "bg-green-500" : p.status === "running" ? colors.bg : "bg-zinc-700";
          const isNext = i === nextPendingIdx && currentPhaseIdx === -1;
          return (
            <div key={p.id} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-2 rounded-full ${bg} ${isNext ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-zinc-900" : ""}`} />
              <span className={`text-[9px] ${p.status === "done" ? "text-green-400" : p.status === "running" ? colors.text : isNext ? "text-blue-400" : "text-zinc-600"}`}>{p.type.charAt(0).toUpperCase() + p.type.slice(1)}</span>
            </div>
          );
        })}
      </div>
      {!allDone && currentPhaseIdx === -1 && nextPendingIdx >= 0 && <div className="text-[11px] text-blue-400 mb-2">⏭ Next: {PHASE_LABELS[wave.phases[nextPendingIdx].type]}</div>}
      {currentPhaseIdx >= 0 && currentPhaseIdx < wave.phases.length - 1 && <div className="text-[11px] text-zinc-400 mb-2">⏭ After this: {PHASE_LABELS[wave.phases[currentPhaseIdx + 1].type]}</div>}
      {expanded && <div className="space-y-2 mt-2">{wave.phases.map((phase) => <PhaseBlock key={phase.id} phase={phase} allAds={allAds} onUpdate={onUpdatePhase} />)}</div>}
    </div>
  );
}

function WaveVaultPreview({ waveId, campaignId }: { waveId: string; campaignId: string }) {
  const [folders, setFolders] = useState<CboFolder[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchFolders(waveId)
      .then((d) => { setFolders(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [waveId]);

  const root = folders.find((f) => f.type === "root");
  const sectionFor = (t: string) => folders.find((f) => f.type === t && f.parentId === root?.id);
  const childrenOf = (sid: string) => folders.filter((f) => f.parentId === sid);

  const sections = [
    { type: "desire", label: "Desires", icon: "🎯", color: "text-orange-300", border: "border-orange-500/20", bg: "bg-orange-500/5" },
    { type: "angle", label: "Angles", icon: "📐", color: "text-amber-300", border: "border-amber-500/20", bg: "bg-amber-500/5" },
    { type: "awareness", label: "Awareness", icon: "👁", color: "text-yellow-300", border: "border-yellow-500/20", bg: "bg-yellow-500/5" },
    { type: "copy", label: "Copies", icon: "📝", color: "text-sky-300", border: "border-sky-500/20", bg: "bg-sky-500/5" },
    { type: "combo", label: "Combos", icon: "🧩", color: "text-purple-300", border: "border-purple-500/20", bg: "bg-purple-500/5" },
  ];

  const totalItems = sections.reduce((sum, s) => {
    const sec = sectionFor(s.type);
    return sum + (sec ? childrenOf(sec.id).length : 0);
  }, 0);

  const handleCopy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

  if (!loaded || !root) return null;
  if (totalItems === 0) return (
    <div className="border border-zinc-800 rounded-lg p-4 text-center">
      <p className="text-[11px] text-zinc-500">No vault items yet.{" "}
        <Link href={`/ads/campaign/${campaignId}/wave/${waveId}`} className="text-purple-400 hover:text-purple-300">Open vault →</Link>
      </p>
    </div>
  );

  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-300">📂 Vault — {totalItems} item{totalItems !== 1 ? "s" : ""}</span>
        <Link href={`/ads/campaign/${campaignId}/wave/${waveId}`} className="text-[11px] text-purple-400 hover:text-purple-300">Open full vault →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {sections.map((s) => {
          const sec = sectionFor(s.type);
          const items = sec ? childrenOf(sec.id) : [];
          if (items.length === 0) return null;
          return (
            <div key={s.type} className={`border ${s.border} ${s.bg} rounded-lg p-3`}>
              <div className={`text-[10px] font-semibold ${s.color} mb-2`}>{s.icon} {s.label}<span className="ml-1 text-zinc-500">({items.length})</span></div>
              <div className="space-y-1.5">
                {items.slice(0, 5).map((item) => {
                  const text = s.type === "desire" ? item.desire || item.name : s.type === "angle" ? item.angle || item.name : s.type === "awareness" ? item.awareness || item.name : s.type === "copy" ? item.content?.slice(0, 80) || item.name : item.name;
                  return (
                    <div key={item.id} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                      <span className="flex-1 truncate">{text}</span>
                      <button onClick={() => handleCopy(text || "")} className="text-[9px] text-zinc-600 hover:text-white px-1" title="Copy">📋</button>
                    </div>
                  );
                })}
                {items.length > 5 && <div className="text-[10px] text-zinc-600">+{items.length - 5} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Inline copy preview for table rows ─── */

function AdCopiesInline({ adId }: { adId: string }) {
  const [copies, setCopies] = useState<CboItemCopy[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchAdCopies(adId)
      .then((d) => { setCopies(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [adId]);

  if (!loaded || copies.length === 0) return <span className="text-zinc-600 text-[10px]">—</span>;

  return (
    <div className="space-y-1">
      {(showAll ? copies : copies.slice(0, 1)).map((c) => (
        <div key={c.id} className="text-[11px] text-sky-300 truncate max-w-[200px]" title={c.content}>
          {c.title}
        </div>
      ))}
      {copies.length > 1 && (
        <button onClick={() => setShowAll(!showAll)} className="text-[10px] text-zinc-500 hover:text-sky-400">
          {showAll ? "Show less" : `+${copies.length - 1} more`}
        </button>
      )}
    </div>
  );
}

/* ─── Expanded row detail ─── */

function ExpandedAdRow({ ad, colSpan }: { ad: Ad; colSpan: number }) {
  const [copies, setCopies] = useState<CboItemCopy[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewCopy, setViewCopy] = useState<CboItemCopy | null>(null);
  const [viewEditing, setViewEditing] = useState(false);
  const [viewTitle, setViewTitle] = useState("");
  const [viewContent, setViewContent] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAdCopies(ad.id)
      .then((d) => { setCopies(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [ad.id]);

  const openCopyModal = (c: CboItemCopy) => {
    setViewCopy(c);
    setViewTitle(c.title);
    setViewContent(c.content);
    setViewEditing(false);
    setCopied(false);
  };

  const handleCopyText = async () => {
    try { await navigator.clipboard.writeText(viewContent); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {viewCopy && (
        <tr><td colSpan={colSpan} className="p-0">
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setViewCopy(null)}>
            <div
              className="bg-zinc-900 border border-sky-500 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-sky-500/30">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-sky-400">📝 Copy</span>
                  {viewEditing ? (
                    <input
                      value={viewTitle}
                      onChange={(e) => setViewTitle(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                    />
                  ) : (
                    <span className="text-[11px] text-zinc-400">— {viewTitle}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!viewEditing && (
                    <button
                      onClick={handleCopyText}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${copied ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500"}`}
                    >
                      {copied ? "✓ Copied" : "📋 Copy"}
                    </button>
                  )}
                  {!viewEditing && (
                    <button
                      onClick={() => setViewEditing(true)}
                      className="px-3 py-1 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
                    >
                      ✎ Edit
                    </button>
                  )}
                  <button
                    onClick={() => setViewCopy(null)}
                    className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 flex items-center justify-center text-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {viewEditing ? (
                  <textarea
                    value={viewContent}
                    onChange={(e) => setViewContent(e.target.value)}
                    autoFocus
                    rows={14}
                    className="w-full bg-zinc-800 border border-sky-500/40 rounded-lg px-4 py-3 text-sm text-zinc-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-y min-h-[250px] font-mono"
                  />
                ) : (
                  <div className="rounded-lg p-4 border border-sky-500/20 bg-sky-500/10">
                    <pre className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {viewContent || <span className="text-zinc-600 italic">Empty</span>}
                    </pre>
                  </div>
                )}
              </div>
              {viewEditing && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-sky-500/30">
                  <div className="text-[11px] text-zinc-500">
                    {viewTitle !== viewCopy.title || viewContent !== viewCopy.content
                      ? <span className="text-yellow-400">● Unsaved changes</span>
                      : <span>No changes</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setViewTitle(viewCopy.title); setViewContent(viewCopy.content); setViewEditing(false); }}
                      className="px-4 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const { updateItemCopy } = await import("@/lib/storage");
                          await updateItemCopy(viewCopy.id, { title: viewTitle.trim(), content: viewContent.trim() });
                          const updated = { ...viewCopy, title: viewTitle.trim(), content: viewContent.trim() };
                          setCopies(prev => prev.map(c => c.id === viewCopy.id ? updated : c));
                          setViewCopy(updated);
                          setViewEditing(false);
                        } catch (err: any) { alert("Failed: " + (err?.message || "Unknown error")); }
                      }}
                      disabled={viewTitle === viewCopy.title && viewContent === viewCopy.content}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        viewTitle !== viewCopy.title || viewContent !== viewCopy.content
                          ? "bg-blue-600 text-white hover:bg-blue-500"
                          : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      } disabled:opacity-50`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </td></tr>
      )}
      <tr className="bg-zinc-900/80">
        <td colSpan={colSpan} className="px-4 py-4 border-b border-zinc-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="rounded-md p-3 border border-orange-500/30 bg-orange-500/5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 mb-1">Desire</div>
                <div className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{ad.desire}</div>
              </div>
              <div className="rounded-md p-3 border border-amber-500/30 bg-amber-500/5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-1">Angle</div>
                <div className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{ad.angle}</div>
              </div>
            </div>
            <div className="space-y-3">
              {ad.targetAvatar && (
                <div className="rounded-md p-3 border border-violet-500/30 bg-violet-500/5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-400 mb-1">Target Avatar</div>
                  <div className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{ad.targetAvatar}</div>
                </div>
              )}
              {ad.notes && (
                <div className="rounded-md p-3 border border-zinc-700 bg-zinc-800/60">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Notes</div>
                  <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{ad.notes}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                  Awareness: <span className="text-yellow-300">{ad.awareness}</span>
                </span>
                <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                  Format: <span className="text-fuchsia-300">{ad.format}</span>
                </span>
                <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                  Duration: <span className="text-blue-300">{ad.duration}d</span>
                </span>
                <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                  Started: <span className="text-zinc-300">{new Date(ad.createdAt).toLocaleDateString()}</span>
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 mb-2">📝 Ad Copies</div>
              {!loaded ? (
                <div className="text-[11px] text-zinc-600">Loading…</div>
              ) : copies.length === 0 ? (
                <div className="text-[11px] text-zinc-600">No copies attached</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {copies.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-md border border-sky-500/20 bg-sky-500/5 p-2.5 cursor-pointer hover:border-sky-500/40 transition-colors"
                      onClick={() => openCopyModal(c)}
                    >
                      <div className="text-[11px] font-medium text-sky-300 mb-1">{c.title}</div>
                      <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap leading-relaxed font-sans line-clamp-3">{c.content}</pre>
                      <div className="text-[9px] text-zinc-600 mt-1">Click to view full →</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

/* ─── Editable Field Modal (Desire / Angle) ─── NEW ─── */

function EditFieldModal({
  ad,
  field,
  onClose,
  onSave,
}: {
  ad: Ad;
  field: "desire" | "angle" | "targetAvatar";
  onClose: () => void;
  onSave: (ad: Ad, field: "desire" | "angle" | "targetAvatar", value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(field === "desire" ? ad.desire || "" : field === "angle" ? ad.angle || "" : ad.targetAvatar || "");
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const original = field === "desire" ? ad.desire || "" : field === "angle" ? ad.angle || "" : ad.targetAvatar || "";
  const hasChanges = value !== original;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await onSave(ad, field, value);
      onClose();
    } catch (err: any) {
      alert("Failed to save: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };


    const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
    const colors =
    field === "desire"
      ? { border: "border-orange-500", bg: "bg-orange-500/10", text: "text-orange-400", label: "🎯 Desire", ring: "focus:ring-orange-500/40" }
      : field === "angle"
      ? { border: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-400", label: "📐 Angle", ring: "focus:ring-amber-500/40" }
      : { border: "border-violet-500", bg: "bg-violet-500/10", text: "text-violet-400", label: "👤 Target Avatar", ring: "focus:ring-violet-500/40" };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`bg-zinc-900 border ${colors.border} rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${colors.border}/30`}>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${colors.text}`}>{colors.label}</span>
            <span className="text-[11px] text-zinc-500">— {ad.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={handleCopy}
                className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                  copied
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500"
                }`}
              >
                {copied ? "✓ Copied" : "📋 Copy"}
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
              >
                ✎ Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 flex items-center justify-center text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isEditing ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              rows={10}
              className={`w-full bg-zinc-800 border ${colors.border}/40 rounded-lg px-4 py-3 text-sm text-zinc-200 leading-relaxed focus:outline-none focus:ring-2 ${colors.ring} resize-y min-h-[200px]`}
            />
          ) : (
            <div className={`rounded-lg p-4 border ${colors.border}/20 ${colors.bg}`}>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {value || <span className="text-zinc-600 italic">Empty</span>}
              </p>
            </div>
          )}
        </div>

        {/* Footer — only visible in edit mode */}
        {isEditing && (
          <div className={`flex items-center justify-between px-5 py-3 border-t ${colors.border}/30`}>
            <div className="text-[11px] text-zinc-500">
              {hasChanges ? (
                <span className="text-yellow-400">● Unsaved changes</span>
              ) : (
                <span>No changes</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setValue(original); setIsEditing(false); }}
                className="px-4 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hasChanges ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                } disabled:opacity-50`}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */

export default function CampaignPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [waves, setWaves] = useState<CboWave[]>([]);
  const [activeWaveId, setActiveWaveId] = useState<string | null>(null);
  const [showNewWave, setShowNewWave] = useState(false);
  const [newWaveName, setNewWaveName] = useState("");

  const [pendingDeleteWaveId, setPendingDeleteWaveId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [variantParentId, setVariantParentId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desire, setDesire] = useState("");
  const [angle, setAngle] = useState("");
  const [awareness, setAwareness] = useState<AwarenessLevel>("Problem aware");
  const [targetAvatar, setTargetAvatar] = useState("");
  const [notes, setNotes] = useState("");
  const [format, setFormat] = useState<FormatType>("UGC");
  const [formTestFocus, setFormTestFocus] = useState<TestFocus>("desire");
  const [duration, setDuration] = useState(7);
  const [startDate, setStartDate] = useState(new Date().toISOString());

  const [globalFocus, setGlobalFocus] = useState<TestFocus | "all">("all");
  const [filterDesire, setFilterDesire] = useState("");
  const [filterAngle, setFilterAngle] = useState("");
  const [filterAwareness, setFilterAwareness] = useState<AwarenessLevel | "All">("All");
  const [showOnlyWinners, setShowOnlyWinners] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmVariantDeleteId, setConfirmVariantDeleteId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [colorBy, setColorBy] = useState<Set<string>>(new Set());
  const toggleColorBy = (field: string) => {
    setColorBy(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  /* ─── NEW: Field edit modal state ─── */
  const [fieldEditAd, setFieldEditAd] = useState<Ad | null>(null);
    const [fieldEditField, setFieldEditField] = useState<"desire" | "angle" | "targetAvatar">("desire");

  const openFieldEdit = (ad: Ad, field: "desire" | "angle" | "targetAvatar") => {
    setFieldEditAd(ad);
    setFieldEditField(field);
  };
  const handleFieldSave = async (ad: Ad, field: "desire" | "angle" | "targetAvatar", value: string) => {
    const updated = { ...ad, [field]: value };
    await updateAd(updated);
    await reload();
  };

  const reload = async () => {
    if (!id) return;
    try {
      const c = await fetchCampaignWithAds(id); if (c) setCampaign(c);
      const w = await fetchWaves(id); setWaves(w);
      if (w.length > 0 && !activeWaveId) setActiveWaveId(w[0].id);
    } catch (err: any) { console.error("reload error:", err); }
  };

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true); setError(null);
      try {
        const c = await fetchCampaignWithAds(id!); setCampaign(c);
        const w = await fetchWaves(id!); setWaves(w);
        if (w.length > 0) setActiveWaveId(w[0].id);
      } catch (err: any) { setError(err?.message || "Unknown error"); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  const colorMaps = useMemo(() => {
    const ads = campaign?.ads || [];
    const maps: Record<string, Record<string, string>> = {};
    const fields = ["desire", "angle", "awareness", "targetAvatar", "format"];
    for (const field of fields) {
      if (!colorBy.has(field)) continue;
      const uniqueValues = [...new Set(ads.map(a => getAdFieldValue(a, field)).filter(Boolean))];
      const map: Record<string, string> = {};
      uniqueValues.forEach((val, i) => { map[val] = GROUP_COLORS[i % GROUP_COLORS.length]; });
      maps[field] = map;
    }
    return maps;
  }, [colorBy, campaign?.ads]);

  if (loading) return <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">Loading…</div>;
  if (error) return <div className="min-h-screen bg-zinc-950 text-red-400 flex items-center justify-center"><div className="text-center"><p className="mb-2">Error: {error}</p><Link href="/ads" className="text-blue-400 hover:underline">← Back</Link></div></div>;
  if (!campaign || !id) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center"><div className="text-center"><p className="text-zinc-400 mb-4">Campaign not found</p><Link href="/ads" className="text-blue-400 hover:underline">← Back</Link></div></div>;

  const openNewForm = () => { setEditingAd(null); setVariantParentId(null); setName(""); setDesire(""); setAngle(""); setAwareness("Problem aware"); setTargetAvatar(""); setNotes(""); setFormat("UGC"); setFormTestFocus("desire"); setDuration(7); setStartDate(new Date().toISOString()); setShowForm(true); };
  const openVariantForm = (parent: Ad) => { setEditingAd(null); setVariantParentId(parent.id); setName((parent.name || "") + " / Variant"); setDesire(parent.desire || ""); setAngle(parent.angle || ""); setAwareness(parent.awareness || "Problem aware"); setTargetAvatar(parent.targetAvatar || ""); setNotes(""); setFormat(parent.format || "UGC"); setFormTestFocus(parent.testFocus || "desire"); setDuration(parent.duration || 7); setStartDate(new Date().toISOString()); setShowForm(true); };
  const openEditForm = (ad: Ad) => { setEditingAd(ad); setVariantParentId(ad.parentId || null); setName(ad.name || ""); setDesire(ad.desire || ""); setAngle(ad.angle || ""); setAwareness(ad.awareness || "Problem aware"); setTargetAvatar(ad.targetAvatar || ""); setNotes(ad.notes || ""); setFormat(ad.format || "UGC"); setFormTestFocus(ad.testFocus || "desire"); setDuration(ad.duration || 7); setStartDate(ad.createdAt); setShowForm(true); };

  const handleSaveAd = async () => {
    const nt = name.trim(), dt = desire.trim(), at = angle.trim();
    if (!nt || !dt || !at) return;
    try {
      if (editingAd) {
        await updateAd({ ...editingAd, name: nt, desire: dt, angle: at, awareness, targetAvatar, notes, format, testFocus: formTestFocus, duration, createdAt: startDate });
      } else {
        await insertAd(campaign.id, {
          name: nt, desire: dt, angle: at, awareness, targetAvatar, notes, format,
          testFocus: formTestFocus, status: "testing",
          parentId: variantParentId || undefined,
          createdAt: startDate, duration,
          waveId: activeWaveId,
        });
      }
      await reload(); setShowForm(false); setEditingAd(null); setVariantParentId(null);
    } catch (err: any) { alert("Failed to save ad: " + (err?.message || "Unknown error")); }
  };

  const handleSetStatus = async (adId: string, status: Ad["status"]) => { try { await setAdStatus(adId, status); await reload(); } catch {} };
  const actuallyDelete = async (parentId: string) => { try { await deleteAdWithVariants(parentId); await reload(); } catch {} setConfirmDeleteId(null); };
  const deleteVariantOnly = async (vid: string) => { try { await deleteSingleAd(vid); await reload(); } catch {} setConfirmVariantDeleteId(null); };

  const handleCreateWave = async () => { const t = newWaveName.trim(); if (!t) return; try { await createWave(campaign.id, t); setNewWaveName(""); setShowNewWave(false); await reload(); } catch (err: any) { alert("Failed: " + (err?.message || "Unknown error")); } };
  const handleUpdatePhase = async (phaseId: string, status: string, winnerAds: string[], phaseNotes: string) => { try { await updatePhase(phaseId, status, winnerAds, phaseNotes); await reload(); } catch (err: any) { alert("Failed: " + (err?.message || "Unknown error")); } };
  const handleDeleteWave = async (waveId: string) => { try { await deleteWave(waveId); if (activeWaveId === waveId) setActiveWaveId(null); await reload(); } catch (err: any) { alert("Failed: " + (err?.message || "Unknown error")); } };
  const handleCompleteWave = async (waveId: string) => { try { await updateWaveStatus(waveId, "completed"); await reload(); } catch {} };

  const requestDeleteWave = (waveId: string) => { setPendingDeleteWaveId(waveId); setDeleteConfirmText(""); };
  const confirmDeleteWave = async () => { if (!pendingDeleteWaveId || deleteConfirmText !== "DELETE") return; await handleDeleteWave(pendingDeleteWaveId); setPendingDeleteWaveId(null); setDeleteConfirmText(""); };

  const allAds: Ad[] = campaign.ads || [];
  const filteredAds = allAds.filter((ad) => {
    if (activeWaveId && ad.waveId && ad.waveId !== activeWaveId) return false;
    if (!activeWaveId && ad.waveId) return false;
    if (showOnlyWinners && ad.status !== "winner") return false;
    if (filterDesire && !(ad.desire || "").toLowerCase().includes(filterDesire.toLowerCase())) return false;
    if (filterAngle && !(ad.angle || "").toLowerCase().includes(filterAngle.toLowerCase())) return false;
    if (filterAwareness !== "All" && ad.awareness !== filterAwareness) return false;
    if (globalFocus !== "all" && ad.testFocus !== globalFocus) return false;
    return true;
  });

  const mainAds = filteredAds.filter((a) => !a.parentId);
  const variantsFor = (parentId: string) => filteredAds.filter((a) => a.parentId === parentId);

  const COLOR_FIELDS = ["desire", "angle", "awareness", "targetAvatar", "format"];

  const getRowBars = (ad: Ad) =>
    COLOR_FIELDS
      .filter(f => colorBy.has(f))
      .map(f => ({
        field: f,
        color: colorMaps[f]?.[getAdFieldValue(ad, f)] || "#3f3f46",
        value: getAdFieldValue(ad, f),
      }));

  const getRowBg = (ad: Ad): string | undefined => {
    if (colorBy.size !== 1) return undefined;
    const field = [...colorBy][0];
    const color = colorMaps[field]?.[getAdFieldValue(ad, field)];
    return color ? hexToRgba(color, 0.08) : undefined;
  };

  const fieldColor = (ad: Ad, field: string): string | undefined => {
    if (!colorBy.has(field)) return undefined;
    return colorMaps[field]?.[getAdFieldValue(ad, field)];
  };

  return (
    <div className="min-h-screen text-white">

      {/* ═══ Field Edit Modal (Desire / Angle) ═══ NEW */}
      {fieldEditAd && (
        <EditFieldModal
          ad={fieldEditAd}
          field={fieldEditField}
          onClose={() => setFieldEditAd(null)}
          onSave={handleFieldSave}
        />
      )}

      {/* ═══ Ad Form Modal ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold mb-4">{editingAd ? "Edit Ad" : variantParentId ? "New Variant" : "New Ad"}</h2>
            <div className="space-y-3 mb-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad name / label" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              <textarea value={desire} onChange={(e) => setDesire(e.target.value)} placeholder="Desire (mass desire — can be long form)" rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              <textarea value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="Angle (can be long form)" rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              <input value={targetAvatar} onChange={(e) => setTargetAvatar(e.target.value)} placeholder="Target avatar (e.g. 35-45 busy moms, dog owners 25-40)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400">Start:</span>
                <input type="datetime-local" value={toLocalInputValue(startDate)} onChange={(e) => { const iso = new Date(e.target.value).toISOString(); setStartDate(iso); if (editingAd) setEditingAd({ ...editingAd, createdAt: iso }); }} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2"><span className="text-zinc-400">Awareness:</span><select value={awareness} onChange={(e) => setAwareness(e.target.value as AwarenessLevel)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs">{AWARENESS_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
                <div className="flex items-center gap-2"><span className="text-zinc-400">Format:</span><select value={format} onChange={(e) => setFormat(e.target.value as FormatType)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs">{FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
                <div className="flex items-center gap-2"><span className="text-zinc-400">Test focus:</span><select value={formTestFocus} onChange={(e) => setFormTestFocus(e.target.value as TestFocus)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs">{TEST_FOCUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
              </div>
              <div>
                <span className="text-xs text-zinc-400 block mb-1.5">Test duration:</span>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map((d) => <button key={d} onClick={() => setDuration(d)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${duration === d ? "bg-blue-600 border-blue-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"}`}>{d}d</button>)}
                  <input type="number" min={1} max={90} value={duration} onChange={(e) => setDuration(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))} className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setEditingAd(null); setVariantParentId(null); }} className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-400">Cancel</button>
              <button onClick={handleSaveAd} className="flex-1 py-2 rounded-lg bg-blue-600 text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ New Wave Modal ═══ */}
      {showNewWave && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-full max-w-sm">
            <h2 className="font-bold mb-4">New CBO Wave</h2>
            <input value={newWaveName} onChange={(e) => setNewWaveName(e.target.value)} placeholder="Wave name (e.g. Wave 1)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-blue-500" onKeyDown={(e) => { if (e.key === "Enter") handleCreateWave(); }} />
            <div className="text-[11px] text-zinc-500 mb-4">Creates: Desire → Angle → Awareness → Advertorial → Format + Vault</div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewWave(false)} className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-400">Cancel</button>
              <button onClick={handleCreateWave} disabled={!newWaveName.trim()} className="flex-1 py-2 rounded-lg bg-blue-600 text-sm font-medium disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete Wave Modal ═══ */}
      {pendingDeleteWaveId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-red-700 rounded-xl p-5 w-full max-w-sm">
            <h3 className="text-sm font-bold text-red-400 mb-2">Delete vault and CBO wave?</h3>
            <p className="text-[11px] text-zinc-400 mb-3">This will permanently delete this wave, all vault items, and linked copies. Type <span className="font-mono text-red-300">DELETE</span> to confirm.</p>
            <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-red-500 font-mono" placeholder="DELETE" />
            <div className="flex gap-2">
              <button onClick={() => { setPendingDeleteWaveId(null); setDeleteConfirmText(""); }} className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-400">Cancel</button>
              <button onClick={confirmDeleteWave} disabled={deleteConfirmText !== "DELETE"} className="flex-1 py-2 rounded-lg bg-red-600 text-sm font-medium disabled:opacity-40">Confirm delete</button>
            </div>
          </div>
        </div>
      )}

            {/* ═══ Header ═══ */}
      <header className="border-b border-zinc-800 sticky top-0 bg-zinc-950/90 backdrop-blur-md z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div><Link href="/ads" className="text-sm text-zinc-500 hover:text-white">← Back</Link><h1 className="text-xl font-bold mt-1">{campaign.name}</h1></div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewWave(true)} className="px-4 py-2 rounded-lg bg-purple-600 text-sm font-medium hover:bg-purple-500">+ CBO Wave</button>
            <button onClick={openNewForm} className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium hover:bg-blue-500">+ New Ad</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">

        {/* ═══ CBO Waves ═══ */}
        {waves.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-purple-300">🧪 CBO Testing Waves</h2>
              <div className="text-[11px] text-zinc-500">{waves.length} wave{waves.length > 1 ? "s" : ""}</div>
            </div>
            <div className="flex border-b border-zinc-800 mb-3 overflow-x-auto">
              {waves.map((wave) => {
                const isActive = wave.id === activeWaveId;
                const doneCount = wave.phases.filter((p) => p.status === "done").length;
                return (
                  <div key={wave.id} className="flex items-center">
                    <button onClick={() => setActiveWaveId(isActive ? null : wave.id)}
                      className={`px-4 py-2 text-xs whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${isActive ? "border-purple-500 text-purple-300 bg-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>
                      {wave.name}{wave.status === "completed" && <span className="text-green-400">✓</span>}
                      <span className="text-[9px] text-zinc-600">{doneCount}/{wave.phases.length}</span>
                    </button>
                    <Link href={`/ads/campaign/${id}/wave/${wave.id}`} className="px-1.5 py-2 text-[11px] text-zinc-500 hover:text-purple-300" title="Open vault">📂</Link>
                    <button onClick={() => requestDeleteWave(wave.id)} className="px-1.5 py-2 text-[11px] text-zinc-600 hover:text-red-400" title="Delete wave">🗑</button>
                  </div>
                );
              })}
            </div>
            {activeWaveId && (() => {
              const activeWave = waves.find((w) => w.id === activeWaveId);
              if (!activeWave) return null;
              return (
                <div className="space-y-3">
                  <WaveCard wave={activeWave} allAds={allAds} onUpdatePhase={handleUpdatePhase} onDeleteWave={(wid) => requestDeleteWave(wid)} onCompleteWave={handleCompleteWave} />
                  <WaveVaultPreview waveId={activeWave.id} campaignId={id} />
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ Filters ═══ */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-wrap gap-3 items-center text-xs">
          <input value={filterDesire} onChange={(e) => setFilterDesire(e.target.value)} placeholder="Filter by desire" className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 flex-1 min-w-[140px]" />
          <input value={filterAngle} onChange={(e) => setFilterAngle(e.target.value)} placeholder="Filter by angle" className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 flex-1 min-w-[140px]" />
          <select value={filterAwareness} onChange={(e) => setFilterAwareness(e.target.value as AwarenessLevel | "All")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1"><option value="All">All awareness</option>{AWARENESS_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
          <label className="flex items-center gap-1 text-zinc-400"><input type="checkbox" checked={showOnlyWinners} onChange={(e) => setShowOnlyWinners(e.target.checked)} className="accent-blue-500" />Winners only</label>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-zinc-500 mr-1">Test focus:</span>
          <button onClick={() => setGlobalFocus("all")} className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${globalFocus === "all" ? "border-white bg-white/10 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white"}`}>All</button>
          {TEST_FOCUS_OPTIONS.map((opt) => <button key={opt.id} onClick={() => setGlobalFocus(globalFocus === opt.id ? "all" : opt.id)} className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${globalFocus === opt.id ? `${opt.color} text-white` : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white"}`}>{opt.label}</button>)}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-zinc-500 mr-1">Color by:</span>
          {[
            { id: "desire", label: "Desire", active: "border-orange-500 bg-orange-500/15 text-orange-300" },
            { id: "angle", label: "Angle", active: "border-amber-500 bg-amber-500/15 text-amber-300" },
            { id: "awareness", label: "Awareness", active: "border-yellow-500 bg-yellow-500/15 text-yellow-300" },
            { id: "targetAvatar", label: "Avatar", active: "border-violet-500 bg-violet-500/15 text-violet-300" },
            { id: "format", label: "Format", active: "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-300" },
          ].map((opt) => (
            <button key={opt.id} onClick={() => toggleColorBy(opt.id)}
              className={`px-3 py-1 rounded-full border text-[11px] transition-colors ${colorBy.has(opt.id) ? opt.active : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white"}`}>
              {opt.label}
            </button>
          ))}
          {colorBy.size > 0 && (
            <button onClick={() => setColorBy(new Set())} className="px-2 py-1 text-[10px] text-zinc-500 hover:text-white">✕ Clear</button>
          )}
        </div>

        {/* ═══ ADS TABLE ═══ */}
        {mainAds.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm py-10">No ads match the current filters.</div>
        ) : (
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="text-left px-3 py-2.5 text-zinc-500 font-medium w-8"></th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 font-medium">Name</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 font-medium">Desire</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 font-medium">Angle</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 font-medium">Avatar</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 font-medium">Awareness</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 font-medium">Format</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 font-medium min-w-[120px]">Progress</th>
                    <th className="text-right px-3 py-2.5 text-zinc-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mainAds.map((ad) => {
                    const variants = variantsFor(ad.id);
                    const badge = statusBadge(ad.status);
                    const isExpanded = expandedRowId === ad.id;

                    return (
                      <Fragment key={ad.id}>
                        <tr
                          className={`border-b border-zinc-800/60 hover:bg-zinc-900/60 transition-colors cursor-pointer ${isExpanded ? "bg-zinc-900/80" : ""}`}
                          style={getRowBg(ad) ? { backgroundColor: getRowBg(ad) } : undefined}
                          onClick={() => setExpandedRowId(isExpanded ? null : ad.id)}
                        >
                          <td className="pl-1 pr-2 py-2.5">
                            <div className="flex items-center gap-0.5">
                              {getRowBars(ad).map((bar, i) => (
                                <div key={i} className="w-1 h-6 rounded-sm flex-shrink-0" style={{ backgroundColor: bar.color }} title={`${bar.field}: ${bar.value}`} />
                              ))}
                              <span className={`w-2 h-2 rounded-full ${focusDot(ad.testFocus)} ml-1`} title={ad.testFocus} />
                              <span className="text-zinc-600 text-[10px]">{isExpanded ? "▼" : "▶"}</span>
                            </div>
                          </td>
                                                   <td className="px-3 py-2.5">
                            <div className="font-medium text-zinc-100">{ad.name}</div>
                            <div className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded inline-block border ${focusColor(ad.testFocus)}`}>⚡ {ad.testFocus}</div>
                          </td>
                          {/* ── CLICKABLE DESIRE ── */}
                          <td className="px-3 py-2.5">
                            <div
                              className="text-zinc-300 max-w-[180px] truncate cursor-pointer hover:text-orange-300 transition-colors"
                              style={fieldColor(ad, "desire") ? { color: fieldColor(ad, "desire") } : undefined}
                              title="Click to view/edit desire"
                              onClick={(e) => { e.stopPropagation(); openFieldEdit(ad, "desire"); }}
                            >
                              {ad.desire}
                            </div>
                          </td>
                          {/* ── CLICKABLE ANGLE ── */}
                          <td className="px-3 py-2.5">
                            <div
                              className="text-zinc-300 max-w-[180px] truncate cursor-pointer hover:text-amber-300 transition-colors"
                              style={fieldColor(ad, "angle") ? { color: fieldColor(ad, "angle") } : undefined}
                              title="Click to view/edit angle"
                              onClick={(e) => { e.stopPropagation(); openFieldEdit(ad, "angle"); }}
                            >
                              {ad.angle}
                            </div>
                          </td>
                                                    <td className="px-3 py-2.5">
                            {ad.targetAvatar ? (
                              <div
                                className="flex items-center gap-1.5 max-w-[140px] cursor-pointer hover:text-violet-300 transition-colors"
                                title="Click to view/edit avatar"
                                onClick={(e) => { e.stopPropagation(); openFieldEdit(ad, "targetAvatar"); }}
                              >
                                <span className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-[9px] text-violet-300 flex-shrink-0">👤</span>
                                <span className="text-zinc-300 truncate text-[11px]" style={fieldColor(ad, "targetAvatar") ? { color: fieldColor(ad, "targetAvatar") } : undefined}>{ad.targetAvatar}</span>
                              </div>
                            ) : (
                              <span
                                className="text-zinc-600 text-[10px] cursor-pointer hover:text-violet-400 transition-colors"
                                onClick={(e) => { e.stopPropagation(); openFieldEdit(ad, "targetAvatar"); }}
                              >+ avatar</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] text-yellow-300/80" style={fieldColor(ad, "awareness") ? { color: fieldColor(ad, "awareness") } : undefined}>{ad.awareness}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200" style={fieldColor(ad, "format") ? { color: fieldColor(ad, "format"), borderColor: fieldColor(ad, "format") } : undefined}>{ad.format}</span>
                          </td>
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <MiniProgress ad={ad} />
                          </td>
                                                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {(["winner","loser","testing"] as Ad["status"][]).map((s) => (
                                <button key={s} onClick={() => handleSetStatus(ad.id, s)}
                                  className={`w-6 h-6 rounded text-[10px] ${ad.status === s ? (s === "winner" ? "bg-green-500/30 text-green-300" : s === "loser" ? "bg-red-500/30 text-red-300" : "bg-blue-500/20 text-blue-300") : "bg-zinc-800 text-zinc-600 hover:text-white"}`}
                                  title={s}>{s === "winner" ? "W" : s === "loser" ? "L" : "T"}</button>
                              ))}
                              <button onClick={() => openVariantForm(ad)} className="w-6 h-6 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:text-white" title="Add variant">+V</button>
                              <button onClick={() => openEditForm(ad)} className="w-6 h-6 rounded text-[10px] bg-zinc-800 text-zinc-400 hover:text-white" title="Edit">✎</button>
                              <button onClick={() => confirmDeleteId === ad.id ? actuallyDelete(ad.id) : setConfirmDeleteId(ad.id)}
                                className={`w-6 h-6 rounded text-[10px] ${confirmDeleteId === ad.id ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-600 hover:text-red-400"}`}
                                title="Delete">{confirmDeleteId === ad.id ? "?" : "✕"}</button>
                            </div>
                          </td>
                        </tr>

                                                {isExpanded && <ExpandedAdRow ad={ad} colSpan={9} />}

                        {variants.map((v) => {
                          const vBadge = statusBadge(v.status);
                          const vExpanded = expandedRowId === v.id;
                          return (
                            <Fragment key={v.id}>
                              <tr
                                className={`border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors cursor-pointer bg-zinc-950/50 ${vExpanded ? "bg-zinc-900/60" : ""}`}
                                style={getRowBg(v) ? { backgroundColor: getRowBg(v) } : undefined}
                                onClick={() => setExpandedRowId(vExpanded ? null : v.id)}
                              >
                                <td className="pl-1 pr-2 py-2">
                                  <div className="flex items-center gap-0.5 pl-2">
                                    {getRowBars(v).map((bar, i) => (
                                      <div key={i} className="w-1 h-5 rounded-sm flex-shrink-0" style={{ backgroundColor: bar.color }} title={`${bar.field}: ${bar.value}`} />
                                    ))}
                                    <span className="text-zinc-700 text-[10px] ml-1">↳</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${focusDot(v.testFocus)}`} />
                                    <span className="text-zinc-700 text-[10px]">{vExpanded ? "▼" : "▶"}</span>
                                  </div>
                                </td>
                                                             <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">VAR</span>
                                    <span className="text-zinc-300">{v.name}</span>
                                  </div>
                                </td>
                                {/* ── CLICKABLE DESIRE (variant) ── */}
                                <td className="px-3 py-2">
                                  <div
                                    className="text-zinc-400 max-w-[160px] truncate cursor-pointer hover:text-orange-300 transition-colors"
                                    style={fieldColor(v, "desire") ? { color: fieldColor(v, "desire") } : undefined}
                                    title="Click to view/edit desire"
                                    onClick={(e) => { e.stopPropagation(); openFieldEdit(v, "desire"); }}
                                  >
                                    {v.desire}
                                  </div>
                                </td>
                                {/* ── CLICKABLE ANGLE (variant) ── */}
                                <td className="px-3 py-2">
                                  <div
                                    className="text-zinc-400 max-w-[160px] truncate cursor-pointer hover:text-amber-300 transition-colors"
                                    style={fieldColor(v, "angle") ? { color: fieldColor(v, "angle") } : undefined}
                                    title="Click to view/edit angle"
                                    onClick={(e) => { e.stopPropagation(); openFieldEdit(v, "angle"); }}
                                  >
                                    {v.angle}
                                  </div>
                                </td>
                                                                <td className="px-3 py-2">
                                  {v.targetAvatar ? (
                                    <span
                                      className="text-zinc-400 truncate block max-w-[120px] text-[11px] cursor-pointer hover:text-violet-300 transition-colors"
                                      style={fieldColor(v, "targetAvatar") ? { color: fieldColor(v, "targetAvatar") } : undefined}
                                      onClick={(e) => { e.stopPropagation(); openFieldEdit(v, "targetAvatar"); }}
                                    >{v.targetAvatar}</span>
                                  ) : (
                                    <span
                                      className="text-zinc-700 text-[10px] cursor-pointer hover:text-violet-400 transition-colors"
                                      onClick={(e) => { e.stopPropagation(); openFieldEdit(v, "targetAvatar"); }}
                                    >+ avatar</span>
                                  )}
                                </td>
                                <td className="px-3 py-2"><span className="text-[11px] text-yellow-300/60" style={fieldColor(v, "awareness") ? { color: fieldColor(v, "awareness") } : undefined}>{v.awareness}</span></td>
                                <td className="px-3 py-2"><span className="text-[10px] text-fuchsia-300/60" style={fieldColor(v, "format") ? { color: fieldColor(v, "format"), borderColor: fieldColor(v, "format") } : undefined}>{v.format}</span></td>
                                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><MiniProgress ad={v} /></td>
                                                              <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1">
                                    {(["winner","loser","testing"] as Ad["status"][]).map((s) => (
                                      <button key={s} onClick={() => handleSetStatus(v.id, s)}
                                        className={`w-5 h-5 rounded text-[9px] ${v.status === s ? (s === "winner" ? "bg-green-500/30 text-green-300" : s === "loser" ? "bg-red-500/30 text-red-300" : "bg-blue-500/20 text-blue-300") : "bg-zinc-800 text-zinc-600 hover:text-white"}`}>{s === "winner" ? "W" : s === "loser" ? "L" : "T"}</button>
                                    ))}
                                    <button onClick={() => openEditForm(v)} className="w-5 h-5 rounded text-[9px] bg-zinc-800 text-zinc-500 hover:text-white">✎</button>
                                    <button onClick={() => confirmVariantDeleteId === v.id ? deleteVariantOnly(v.id) : setConfirmVariantDeleteId(v.id)}
                                      className={`w-5 h-5 rounded text-[9px] ${confirmVariantDeleteId === v.id ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-600 hover:text-red-400"}`}>{confirmVariantDeleteId === v.id ? "?" : "✕"}</button>
                                  </div>
                                </td>
                              </tr>
                                                           {vExpanded && <ExpandedAdRow ad={v} colSpan={9} />}
                            </Fragment>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}