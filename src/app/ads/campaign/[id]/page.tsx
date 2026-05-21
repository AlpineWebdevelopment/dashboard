"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Campaign, Ad, FormatType, ConceptType,
  CONCEPTS, FORMATS, conceptEmojis,
} from "@/types/ads";
import {
  fetchCampaignWithAds,
  insertAd,
  updateAd,
  setAdStatus,
  deleteAdWithVariants,
} from "@/lib/ads-storage";

/* ─── Types ─────────────────────────────────────────────────── */

type StatusFilter = "all" | "testing" | "winner" | "loser";

/* ─── Constants ──────────────────────────────────────────────── */

const STATUS = {
  winner: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
    label: "Winner",
  },
  loser: {
    bar: "bg-red-500",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
    label: "Loser",
  },
  testing: {
    bar: "bg-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    dot: "bg-indigo-400",
    label: "Testing",
  },
} as const;

const DURATION_OPTIONS = [3, 5, 7, 10, 14, 21, 30];

/* ─── Helpers ────────────────────────────────────────────────── */

function getProgress(ad: Ad) {
  const elapsed = Date.now() - new Date(ad.createdAt).getTime();
  const total = ad.duration * 86_400_000;
  const percent = Math.min(Math.round((elapsed / total) * 100), 100);
  const daysPassed = Math.min(ad.duration, Math.floor(elapsed / 86_400_000));
  return { percent, daysPassed, done: percent >= 100 };
}

/* ─── Test Matrix ────────────────────────────────────────────── */

function MatrixCell({ ads }: { ads: Ad[] }) {
  if (ads.length === 0) return <span className="text-zinc-700 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center">
      {ads.map((a) => (
        <span
          key={a.id}
          className={`w-2.5 h-2.5 rounded-full ${STATUS[a.status].dot}`}
          title={`${a.name} · ${a.status}`}
        />
      ))}
    </div>
  );
}

function TestMatrix({ ads }: { ads: Ad[] }) {
  const usedFormats = [...new Set(ads.map((a) => a.format))].filter(Boolean) as FormatType[];
  const testedConcepts = CONCEPTS.filter((c) => ads.some((a) => a.concept === c));
  const untestedConcepts = CONCEPTS.filter((c) => !ads.some((a) => a.concept === c));

  if (usedFormats.length === 0) return null;

  return (
    <div className="border border-white/[0.06] bg-white/[0.02] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.05] bg-white/[0.01]">
              <th className="text-left px-4 py-2.5 text-zinc-500 font-medium min-w-[160px]">Concept</th>
              {usedFormats.map((f) => (
                <th key={f} className="px-4 py-2.5 text-zinc-500 font-medium text-center whitespace-nowrap">
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {testedConcepts.map((concept, i) => (
              <tr key={concept} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                <td className="px-4 py-2.5">
                  <span className="text-zinc-300 text-xs">
                    {conceptEmojis[concept]} {concept}
                  </span>
                </td>
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

      {/* Legend + untested */}
      <div className="border-t border-white/[0.05] px-4 py-2.5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />Testing</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Winner</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Loser</span>
        </div>
        {untestedConcepts.length > 0 && (
          <>
            <span className="text-white/[0.06] hidden sm:block">|</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Not tested:</span>
              {untestedConcepts.map((c) => (
                <span key={c} className="text-[10px] text-zinc-700 border border-white/[0.05] rounded-md px-2 py-0.5">
                  {conceptEmojis[c]} {c}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Ad Card ────────────────────────────────────────────────── */

function AdCard({
  ad,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  ad: Ad;
  onStatusChange: (id: string, status: Ad["status"]) => void;
  onEdit: (ad: Ad) => void;
  onDelete: (id: string) => void;
}) {
  const { percent, daysPassed, done } = getProgress(ad);
  const sc = STATUS[ad.status];
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="relative border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.03] transition-all">
      {/* Status bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${sc.bar}`} />

      <div className="pl-5 pr-4 py-4">
        {/* Top row: badges + actions */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${sc.badge}`}>
              {sc.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md border border-violet-500/20 bg-violet-500/10 text-violet-300">
              {conceptEmojis[ad.concept ?? "Other"]} {ad.concept ?? "—"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md border border-white/[0.07] bg-white/[0.03] text-zinc-400">
              {ad.format}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {(["winner", "loser", "testing"] as Ad["status"][]).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(ad.id, s)}
                title={s}
                className={`w-7 h-7 rounded-lg text-[10px] font-bold border transition-colors ${
                  ad.status === s
                    ? s === "winner"
                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                      : s === "loser"
                      ? "bg-red-500/20 border-red-500/30 text-red-300"
                      : "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                    : "border-white/[0.06] bg-white/[0.02] text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                {s === "winner" ? "W" : s === "loser" ? "L" : "T"}
              </button>
            ))}
            <button
              onClick={() => onEdit(ad)}
              title="Edit"
              className="w-7 h-7 rounded-lg text-[11px] border border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
            >
              ✎
            </button>
            <button
              onClick={() => {
                if (confirmDelete) onDelete(ad.id);
                else setConfirmDelete(true);
              }}
              onBlur={() => setTimeout(() => setConfirmDelete(false), 200)}
              title="Delete"
              className={`w-7 h-7 rounded-lg text-[10px] border transition-colors ${
                confirmDelete
                  ? "bg-red-500/20 border-red-500/30 text-red-300"
                  : "border-white/[0.06] bg-white/[0.02] text-zinc-600 hover:text-red-400 hover:bg-white/[0.04]"
              }`}
            >
              {confirmDelete ? "?" : "✕"}
            </button>
          </div>
        </div>

        {/* Name */}
        <p className="text-sm font-medium text-zinc-200 leading-snug">{ad.name}</p>

        {/* Hook */}
        {ad.desire && (
          <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">{ad.desire}</p>
        )}

        {/* Notes */}
        {ad.notes && (
          <div className="mt-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
            <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{ad.notes}</p>
          </div>
        )}

        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-zinc-600 mb-1">
            <span>Day {daysPassed} / {ad.duration}</span>
            {done
              ? <span className="text-emerald-500">✓ Done</span>
              : <span>{percent}%</span>}
          </div>
          <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${done ? "bg-emerald-500/40" : sc.bar + "/40"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Ad Form Modal ──────────────────────────────────────────── */

function AdFormModal({
  editing,
  onClose,
  onSave,
}: {
  editing: Ad | null;
  onClose: () => void;
  onSave: (data: Partial<Ad>) => Promise<void>;
}) {
  const [concept, setConcept] = useState<ConceptType>(editing?.concept ?? "Advertorial");
  const [format, setFormat] = useState<FormatType>(editing?.format ?? "Native Image");
  const [name, setName] = useState(editing?.name ?? "");
  const [hook, setHook] = useState(editing?.desire ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [duration, setDuration] = useState(editing?.duration ?? 7);
  const [saving, setSaving] = useState(false);

  const autoName = `${concept} · ${format}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        concept,
        format,
        name: name.trim() || autoName,
        desire: hook.trim(),
        angle: "",
        notes: notes.trim(),
        duration,
        awareness: "Unaware",
        targetAvatar: "",
        testFocus: "desire",
      });
    } catch (err: any) {
      alert(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgba(14,14,22,0.98)] border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="text-base font-semibold text-zinc-100">
            {editing ? "Edit Ad" : "New Ad Test"}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {/* Concept */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Concept <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CONCEPTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setConcept(c)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                    concept === c
                      ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300"
                      : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                  }`}
                >
                  {conceptEmojis[c]} {c}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Format <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                    format === f
                      ? "bg-violet-600/30 border-violet-500/50 text-violet-300"
                      : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Label <span className="text-zinc-600 font-normal normal-case">(optional — auto: "{autoName}")</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={autoName}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all"
            />
          </div>

          {/* Hook */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Hook / Angle <span className="text-zinc-600 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="What's the specific hook, opening line, or angle you're testing?"
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Notes / Learnings <span className="text-zinc-600 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you observe or learn from this test?"
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all resize-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Test Duration
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    duration === d
                      ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300"
                      : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors text-white"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Test"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function CampaignPage() {
  const params = useParams();
  const id = params?.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [showMatrix, setShowMatrix] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [conceptFilter, setConceptFilter] = useState<ConceptType | "all">("all");
  const [formatFilter, setFormatFilter] = useState<FormatType | "all">("all");

  const load = async () => {
    if (!id) return;
    try {
      const c = await fetchCampaignWithAds(id);
      setCampaign(c);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const openNew = () => { setEditingAd(null); setShowForm(true); };
  const openEdit = (ad: Ad) => { setEditingAd(ad); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingAd(null); };

  const handleSave = async (data: Partial<Ad>) => {
    if (editingAd) {
      await updateAd({ ...editingAd, ...data } as Ad);
    } else {
      await insertAd(id, {
        name: data.name!,
        concept: data.concept,
        desire: data.desire ?? "",
        angle: data.angle ?? "",
        awareness: data.awareness ?? "Unaware",
        targetAvatar: data.targetAvatar ?? "",
        notes: data.notes ?? "",
        format: data.format!,
        testFocus: data.testFocus ?? "desire",
        status: "testing",
        duration: data.duration ?? 7,
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

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>;
  }
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <Link href="/ads" className="text-indigo-400 text-sm hover:underline">← Back to campaigns</Link>
        </div>
      </div>
    );
  }
  if (!campaign) return null;

  const allAds = campaign.ads ?? [];

  const filteredAds = allAds.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (conceptFilter !== "all" && a.concept !== conceptFilter) return false;
    if (formatFilter !== "all" && a.format !== formatFilter) return false;
    return true;
  });

  const testing = allAds.filter((a) => a.status === "testing").length;
  const winners = allAds.filter((a) => a.status === "winner").length;
  const losers  = allAds.filter((a) => a.status === "loser").length;

  const usedConcepts = [...new Set(allAds.map((a) => a.concept).filter(Boolean))] as ConceptType[];
  const usedFormats  = [...new Set(allAds.map((a) => a.format).filter(Boolean))]  as FormatType[];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Form modal */}
      {showForm && (
        <AdFormModal editing={editingAd} onClose={closeForm} onSave={handleSave} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-[rgba(7,7,15,0.85)] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/ads" className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
              ← Campaigns
            </Link>
            <h1 className="text-lg font-semibold text-zinc-100 mt-0.5">{campaign.name}</h1>
          </div>
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium hover:bg-indigo-500 transition-colors text-white"
          >
            + New Test
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Stats strip */}
        <div className="flex items-center gap-5 text-sm">
          <span className="text-zinc-500">{allAds.length} total</span>
          <span className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
            {testing} testing
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            {winners} winner{winners !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
            {losers} loser{losers !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Test Matrix */}
        {allAds.length > 0 && (
          <div>
            <button
              onClick={() => setShowMatrix(!showMatrix)}
              className="flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-2 uppercase tracking-wider font-medium"
            >
              <span className="text-zinc-700">{showMatrix ? "▼" : "▶"}</span>
              Test Matrix
            </button>
            {showMatrix && <TestMatrix ads={allAds} />}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "testing", "winner", "loser"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                statusFilter === s
                  ? "bg-white/10 border-white/20 text-white"
                  : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}

          {usedConcepts.length > 1 && (
            <>
              <span className="w-px h-4 bg-white/[0.08]" />
              <select
                value={conceptFilter}
                onChange={(e) => setConceptFilter(e.target.value as ConceptType | "all")}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-white/[0.18] transition-all"
              >
                <option value="all">All concepts</option>
                {usedConcepts.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </>
          )}

          {usedFormats.length > 1 && (
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as FormatType | "all")}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-white/[0.18] transition-all"
            >
              <option value="all">All formats</option>
              {usedFormats.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </div>

        {/* Ad list */}
        {filteredAds.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            {allAds.length === 0 ? (
              <>
                <p className="text-4xl mb-3">🧪</p>
                <p className="text-sm">No tests yet. Hit "+ New Test" to start tracking.</p>
              </>
            ) : (
              <p className="text-sm">No ads match the current filters.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAds.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                onStatusChange={handleStatusChange}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
