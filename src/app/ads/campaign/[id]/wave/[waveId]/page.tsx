"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CboWave,
  CboFolder,
  CboItemCopy,
  AwarenessLevel,
  FormatType,
  TestFocus,
} from "@/types/ads";
import {
  fetchWaves,
  fetchFolders,
  insertFolder,
  updateFolder,
  deleteFolder,
  fetchItemCopies,
  insertItemCopy,
  updateItemCopy,
  deleteItemCopy,
  insertAd,
  attachCopiesToAd,
  fetchCampaignWithAds,
} from "@/lib/ads-storage";

const AWARENESS_OPTIONS: AwarenessLevel[] = [
  "Unaware",
  "Problem aware",
  "Solution aware",
  "Product aware",
  "Most aware",
  "Other",
];

const FORMAT_OPTIONS: FormatType[] = [
  "UGC",
  "AI Vid",
  "VSL",
  "Slideshow",
  "Static",
  "Native Image",
  "Carousel",
  "Story",
  "Other",
];

const TEST_FOCUS_OPTIONS: { id: TestFocus; label: string }[] = [
  { id: "desire", label: "Desire" },
  { id: "angle", label: "Angle" },
  { id: "awareness", label: "Awareness" },
  { id: "advertorial", label: "Advertorial" },
  { id: "format", label: "Format" },
];

const DURATION_OPTIONS = [3, 5, 7, 10, 14, 21, 30];

const SECTION_META: {
  type: string;
  label: string;
  singular: string;
  icon: string;
  color: string;
  border: string;
  bg: string;
  desc: string;
}[] = [
  {
    type: "desire",
    label: "Desires",
    singular: "Desire",
    icon: "🎯",
    color: "text-orange-300",
    border: "border-orange-500/20",
    bg: "bg-orange-500/[0.04]",
    desc: "What your audience wants. Pain points, dreams, frustrations.",
  },
  {
    type: "angle",
    label: "Angles",
    singular: "Angle",
    icon: "📐",
    color: "text-amber-300",
    border: "border-amber-500/20",
    bg: "bg-amber-500/[0.04]",
    desc: "The hook or perspective you lead with.",
  },
  {
    type: "avatar",
    label: "Avatars",
    singular: "Avatar",
    icon: "👤",
    color: "text-violet-300",
    border: "border-violet-500/20",
    bg: "bg-violet-500/[0.04]",
    desc: "Customer avatars, segments, and personas.",
  },
  {
    type: "copy",
    label: "Copies",
    singular: "Copy",
    icon: "📝",
    color: "text-sky-300",
    border: "border-sky-500/20",
    bg: "bg-sky-500/[0.04]",
    desc: "Ad copy, scripts, hooks, and text variations.",
  },
];

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handle}
      className={`px-1.5 py-1 rounded-md text-[10px] border transition-all ${
        copied
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]"
      }`}
      title="Copy"
    >
      {copied ? "✓" : "📋"}
    </button>
  );
}

export default function WaveLibraryPage() {
  const params = useParams();
  const campaignId = params?.id as string;
  const waveId = params?.waveId as string;

  const [wave, setWave] = useState<CboWave | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [folders, setFolders] = useState<CboFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeSection, setActiveSection] = useState("desire");
  const [quickAddText, setQuickAddText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(
    null
  );

  // Per-item copies cache: folderId -> copies[]
  const [itemCopies, setItemCopies] = useState<
    Record<string, CboItemCopy[]>
  >({});

  // Doc modal for copy blocks
  const [docItem, setDocItem] = useState<CboFolder | null>(null);
  const [docCopy, setDocCopy] = useState<CboItemCopy | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  // View/edit item modal
  const [viewItem, setViewItem] = useState<CboFolder | null>(null);
  const [viewEditing, setViewEditing] = useState(false);
  const [viewValue, setViewValue] = useState("");

  // Doc sheet modal (desire + angle + avatar)
  const [sheetItem, setSheetItem] = useState<CboFolder | null>(null);
  const [sheetDesire, setSheetDesire] = useState("");
  const [sheetAngle, setSheetAngle] = useState("");
  const [sheetAvatar, setSheetAvatar] = useState("");

  // Section-level Docs modal
  const [showSectionDoc, setShowSectionDoc] = useState(false);
  const [sectionDocContent, setSectionDocContent] = useState("");
  const [sectionDocEditing, setSectionDocEditing] = useState(false);

  const openViewItem = (item: CboFolder) => {
    setViewItem(item);
    setViewEditing(false);
    setViewValue(getItemText(item));
  };

  const openSheet = (item: CboFolder) => {
    setSheetItem(item);
    setSheetDesire(item.desire || "");
    setSheetAngle(item.angle || "");
    setSheetAvatar(item.notes || "");
  };

  const openSectionDoc = () => {
    // Load saved doc content from the section-level folder's content field
    setSectionDocContent(currentSectionFolder?.content || "");
    setSectionDocEditing(false);
    setShowSectionDoc(true);
  };

  const handleSaveSectionDoc = async () => {
    if (!currentSectionFolder) return;
    await updateFolder(currentSectionFolder.id, {
      content: sectionDocContent,
    });
    await reloadFolders();
  };

  const handleSheetSave = async () => {
    if (!sheetItem) return;
    await updateFolder(sheetItem.id, {
      desire: sheetDesire.trim(),
      angle: sheetAngle.trim(),
      notes: sheetAvatar.trim(),
    });
    await reloadFolders();
    setSheetItem(null);
  };




  const handleViewSave = async () => {
    if (!viewItem) return;
    const field =
      activeSection === "desire" ? "desire"
      : activeSection === "angle" ? "angle"
      : activeSection === "avatar" ? "notes"
      : activeSection === "copy" ? "content"
      : "name";
    await updateFolder(viewItem.id, { [field]: viewValue.trim() });
    await reloadFolders();
    setViewItem(null);
  };

  // Create ad modal
  const [showAdForm, setShowAdForm] = useState(false);
  const [adSourceItem, setAdSourceItem] = useState<CboFolder | null>(
    null
  );
  const [adName, setAdName] = useState("");
  const [adDesire, setAdDesire] = useState("");
  const [adAngle, setAdAngle] = useState("");
  const [adAwareness, setAdAwareness] =
    useState<AwarenessLevel>("Problem aware");
  const [adFormat, setAdFormat] = useState<FormatType>("UGC");
  const [adTestFocus, setAdTestFocus] = useState<TestFocus>("desire");
  const [adDuration, setAdDuration] = useState(7);
  const [adStartDate, setAdStartDate] = useState(
    new Date().toISOString()
  );
  const [adNotes, setAdNotes] = useState("");
  const [adTargetAvatar, setAdTargetAvatar] = useState("");
  const [selectedCopyIds, setSelectedCopyIds] = useState<string[]>([]);

  const reloadFolders = async () => {
    const data = await fetchFolders(waveId);
    setFolders(data);
  };

  const loadCopiesFor = async (folderId: string) => {
    const data = await fetchItemCopies(folderId);
    setItemCopies((prev) => ({ ...prev, [folderId]: data }));
    return data;
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const c = await fetchCampaignWithAds(campaignId);
        if (c) setCampaignName(c.name);
        const allWaves = await fetchWaves(campaignId);
        const found = allWaves.find((w) => w.id === waveId);
        if (found) setWave(found);
        await reloadFolders();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [campaignId, waveId]);

  // Load copies when expanding an item
  useEffect(() => {
    if (expandedId) loadCopiesFor(expandedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId]);

  const root = folders.find((f) => f.type === "root");
  const sectionFor = (type: string) =>
    folders.find((f) => f.type === type && f.parentId === root?.id);
  const childrenOf = (sectionId: string) =>
    folders.filter((f) => f.parentId === sectionId);

  const currentSection = SECTION_META.find(
    (s) => s.type === activeSection
  )!;
  const currentSectionFolder = sectionFor(activeSection);
  const currentItems = currentSectionFolder
    ? childrenOf(currentSectionFolder.id)
    : [];

  const sectionLabel = currentSection.label.toLowerCase();

  const openAllDocs = () => {
    currentItems.forEach((item) => openSheet(item));
  };

  const getItemText = (item: CboFolder): string => {
    if (activeSection === "desire") return item.desire || item.name || "";
    if (activeSection === "angle") return item.angle || item.name || "";
    if (activeSection === "avatar") return item.notes || item.name || "";
    if (activeSection === "copy") return item.content || item.name || "";
    return item.name || "";
  };



  const handleQuickAdd = async () => {
    const text = quickAddText.trim();
    if (!text || !currentSectionFolder) return;

    const payload: any = {
      waveId,
      parentId: currentSectionFolder.id,
      name: text.length > 60 ? text.slice(0, 60) + "…" : text,
      type: activeSection,
    };

    if (activeSection === "desire") payload.desire = text;
    else if (activeSection === "angle") payload.angle = text;
    else if (activeSection === "avatar") payload.notes = text;
    else if (activeSection === "copy") payload.content = text;
    else payload.name = text;

    await insertFolder(payload);
    setQuickAddText("");
    await reloadFolders();
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteFolder(itemId);
    setConfirmDeleteId(null);
    await reloadFolders();
  };

  // Doc modal open/save/delete
  const openDocModal = (item: CboFolder, copy: CboItemCopy | null) => {
    setDocItem(item);
    setDocCopy(copy);
    setDocTitle(copy?.title || "");
    setDocContent(copy?.content || "");
  };

  const handleSaveDoc = async () => {
    if (!docItem || !docTitle.trim() || !docContent.trim()) return;

    if (docCopy) {
      await updateItemCopy(docCopy.id, {
        title: docTitle.trim(),
        content: docContent.trim(),
      });
    } else {
      await insertItemCopy({
        folderId: docItem.id,
        title: docTitle.trim(),
        content: docContent.trim(),
      });
    }

    await loadCopiesFor(docItem.id);

    setDocItem(null);
    setDocCopy(null);
  };

  const handleDeleteCopy = async (copyId: string, folderId: string) => {
    await deleteItemCopy(copyId);
    await loadCopiesFor(folderId);
  };

  // Create ad from an item
  const openAdFromItem = async (item: CboFolder) => {
    const text = getItemText(item);
    const copies = await loadCopiesFor(item.id);

    setAdSourceItem(item);
    setAdName(text.length > 60 ? text.slice(0, 60) + "…" : text);
    setAdDesire(
      item.desire || (activeSection === "desire" ? text : "")
    );
    setAdAngle(item.angle || (activeSection === "angle" ? text : ""));
    setAdAwareness(
      (item.awareness as AwarenessLevel) || "Problem aware"
    );
    setAdFormat((item.format as FormatType) || "UGC");
    setAdTestFocus(
      activeSection === "angle"
        ? "angle"
        : activeSection === "avatar"
        ? "desire"
        : "desire"
    );
    setAdDuration(7);
    setAdStartDate(new Date().toISOString());
    setAdNotes("");

    // select all copies by default
    setSelectedCopyIds(copies.map((c) => c.id));

    setShowAdForm(true);
  };

 const handleCreateAd = async () => {
  if (!adName.trim() || !adDesire.trim() || !adAngle.trim()) return;

  try {
    const adId = await insertAd(campaignId, {
      name: adName.trim(),
      desire: adDesire.trim(),
      angle: adAngle.trim(),
      awareness: adAwareness,
      format: adFormat,
      testFocus: adTestFocus,
      status: "testing",
      duration: adDuration,
      createdAt: adStartDate,
      notes: adNotes,
      waveId: waveId,
      targetAvatar: adTargetAvatar.trim(),
    });

    if (selectedCopyIds.length > 0) {
      await attachCopiesToAd(adId, selectedCopyIds);
    }

    setShowAdForm(false);
    setAdSourceItem(null);
    alert("Ad created! Go back to the campaign page to see it.");
  } catch (err: any) {
    alert("Failed: " + (err?.message || "Unknown error"));
  }
};

  if (loading)
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        Loading…
      </div>
    );

  if (!wave)
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <div className="text-center">
          <p>Wave not found</p>
          <Link
            href={`/ads/campaign/${campaignId}`}
            className="text-indigo-400 hover:underline mt-2 block"
          >
            ← Back
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Doc modal */}
      {docItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(14,14,22,0.98)] border border-white/[0.1] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div>
                <span className="text-sm font-semibold text-zinc-100">
                  📝 {docCopy ? "Edit" : "New"} Copy
                </span>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  For: {getItemText(docItem).slice(0, 80)}
                </p>
              </div>
              <button
                onClick={() => {
                  setDocItem(null);
                  setDocCopy(null);
                }}
                className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] flex items-center justify-center text-sm transition-all"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1.5">
                  Title *
                </label>
                <input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. VSL Script v1, Headline A, Hook #3"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 block mb-1.5">
                  Content *
                </label>
                <textarea
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Write your full copy here..."
                  className="w-full min-h-[350px] bg-white/[0.04] border border-white/[0.08] rounded-lg px-5 py-4 text-sm text-zinc-300 placeholder-zinc-600 leading-relaxed focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all resize-y font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-white/[0.06]">
              <button
                onClick={() => {
                  setDocItem(null);
                  setDocCopy(null);
                }}
                className="flex-1 py-2 rounded-lg border border-white/[0.07] bg-white/[0.03] text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDoc}
                disabled={!docTitle.trim() || !docContent.trim()}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View/edit item modal */}
      {viewItem && (() => {
        const originalText = getItemText(viewItem);
        const hasChanges = viewValue !== originalText;
        const sectionColors: Record<string, { border: string; bg: string; text: string; label: string; ring: string }> = {
          desire: { border: "border-orange-500/20", bg: "bg-orange-500/[0.04]", text: "text-orange-400", label: "🎯 Desire", ring: "focus:border-orange-500/30" },
          angle: { border: "border-amber-500/20", bg: "bg-amber-500/[0.04]", text: "text-amber-400", label: "📐 Angle", ring: "focus:border-amber-500/30" },
          awareness: { border: "border-yellow-500/20", bg: "bg-yellow-500/[0.04]", text: "text-yellow-400", label: "👁 Awareness", ring: "focus:border-yellow-500/30" },
          copy: { border: "border-sky-500/20", bg: "bg-sky-500/[0.04]", text: "text-sky-400", label: "📝 Copy", ring: "focus:border-sky-500/30" },
          combo: { border: "border-purple-500/20", bg: "bg-purple-500/[0.04]", text: "text-purple-400", label: "🧩 Combo", ring: "focus:border-purple-500/30" },
        };
        const colors = sectionColors[activeSection] || sectionColors.desire;

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewItem(null)}>
            <div
              className={`bg-[rgba(14,14,22,0.98)] border ${colors.border} rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-5 py-3 border-b ${colors.border}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${colors.text}`}>{colors.label}</span>
                  <span className="text-[11px] text-zinc-500">— {viewItem.name?.slice(0, 40)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!viewEditing && (
                    <CopyBtn text={viewValue} />
                  )}
                  {!viewEditing && (
                    <button
                      onClick={() => setViewEditing(true)}
                      className="px-3 py-1 rounded-lg text-xs border border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
                    >
                      ✎ Edit
                    </button>
                  )}
                  <button
                    onClick={() => setViewItem(null)}
                    className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] flex items-center justify-center text-sm transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {viewEditing ? (
                  <textarea
                    value={viewValue}
                    onChange={(e) => setViewValue(e.target.value)}
                    autoFocus
                    rows={10}
                    className={`w-full bg-white/[0.04] border ${colors.border} rounded-lg px-4 py-3 text-sm text-zinc-300 leading-relaxed focus:outline-none ${colors.ring} focus:bg-white/[0.06] transition-all resize-y min-h-[200px]`}
                  />
                ) : (
                  <div className={`rounded-lg p-4 border ${colors.border} ${colors.bg}`}>
                    <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {viewValue || <span className="text-zinc-600 italic">Empty</span>}
                    </p>
                  </div>
                )}
              </div>
              {viewEditing && (
                <div className={`flex items-center justify-between px-5 py-3 border-t ${colors.border}`}>
                  <div className="text-[11px] text-zinc-500">
                    {hasChanges ? <span className="text-yellow-400">● Unsaved changes</span> : <span>No changes</span>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setViewValue(originalText); setViewEditing(false); }}
                      className="px-4 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleViewSave}
                      disabled={!hasChanges}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        hasChanges ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-white/[0.03] text-zinc-600 cursor-not-allowed"
                      } disabled:opacity-50`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Create ad modal */}
      {showAdForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(14,14,22,0.98)] border border-white/[0.1] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-base font-semibold text-zinc-100 mb-5">Create Ad Card</h2>
            <div className="space-y-3 mb-5">
              <input
                value={adName}
                onChange={(e) => setAdName(e.target.value)}
                placeholder="Ad name *"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all"
              />
              <input
                value={adDesire}
                onChange={(e) => setAdDesire(e.target.value)}
                placeholder="Desire *"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all"
              />
              <input
                value={adAngle}
                onChange={(e) => setAdAngle(e.target.value)}
                placeholder="Angle *"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all"
              />
              <input
                value={adTargetAvatar}
                onChange={(e) => setAdTargetAvatar(e.target.value)}
                placeholder="Target avatar (e.g. 35-45 busy moms, dog owners 25-40)"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500/30 focus:bg-white/[0.06] transition-all"
              />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500">Start:</span>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(adStartDate)}
                  onChange={(e) =>
                    setAdStartDate(
                      new Date(e.target.value).toISOString()
                    )
                  }
                  className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-white/[0.18] transition-all"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Awareness:</span>
                  <select
                    value={adAwareness}
                    onChange={(e) =>
                      setAdAwareness(e.target.value as AwarenessLevel)
                    }
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-white/[0.18] transition-all"
                  >
                    {AWARENESS_OPTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Format:</span>
                  <select
                    value={adFormat}
                    onChange={(e) =>
                      setAdFormat(e.target.value as FormatType)
                    }
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-white/[0.18] transition-all"
                  >
                    {FORMAT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Test focus:</span>
                  <select
                    value={adTestFocus}
                    onChange={(e) =>
                      setAdTestFocus(e.target.value as TestFocus)
                    }
                    className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-white/[0.18] transition-all"
                  >
                    {TEST_FOCUS_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block mb-1.5">
                  Duration:
                </span>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setAdDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        adDuration === d
                          ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300"
                          : "border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={adNotes}
                onChange={(e) => setAdNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all resize-none"
              />

              {/* Copy selection section */}
              {adSourceItem && (itemCopies[adSourceItem.id] || []).length > 0 && (
                <div className="border border-white/[0.06] bg-white/[0.02] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-zinc-500">
                      Attach copies to this card:
                    </span>
                    <button
                      onClick={() =>
                        setSelectedCopyIds(
                          (itemCopies[adSourceItem.id] || []).map(
                            (c) => c.id
                          )
                        )
                      }
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Select all
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(itemCopies[adSourceItem.id] || []).map((copy) => (
                      <label
                        key={copy.id}
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] cursor-pointer transition-all ${
                          selectedCopyIds.includes(copy.id)
                            ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                            : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCopyIds.includes(copy.id)}
                          onChange={() =>
                            setSelectedCopyIds((prev) =>
                              prev.includes(copy.id)
                                ? prev.filter((id) => id !== copy.id)
                                : [...prev, copy.id]
                            )
                          }
                          className="accent-indigo-500"
                        />
                        <span className="truncate">{copy.title}</span>
                        <span className="text-[9px] text-zinc-600 ml-auto">
                          {copy.content.length} chars
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdForm(false)}
                className="flex-1 py-2 rounded-lg border border-white/[0.07] bg-white/[0.03] text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAd}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-sm font-medium hover:bg-indigo-500 transition-colors text-white"
              >
                Create Ad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Docs modal */}
      {showSectionDoc && (() => {
        const savedContent = currentSectionFolder?.content || "";
        const hasChanges = sectionDocContent !== savedContent;
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSectionDoc(false)}>
            <div
              className={`bg-[rgba(14,14,22,0.98)] border ${currentSection.border} rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-5 py-3 border-b ${currentSection.border}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${currentSection.color}`}>
                    📄 {currentSection.label} — Docs
                  </span>
                  {hasChanges && (
                    <span className="text-[10px] text-yellow-400">● Unsaved</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <CopyBtn text={sectionDocContent} />
                  {!sectionDocEditing ? (
                    <button
                      onClick={() => setSectionDocEditing(true)}
                      className="px-3 py-1 rounded-lg text-xs border border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
                    >
                      ✎ Edit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={async () => {
                          await handleSaveSectionDoc();
                          setSectionDocEditing(false);
                        }}
                        disabled={!hasChanges}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          hasChanges
                            ? "bg-indigo-600 text-white hover:bg-indigo-500"
                            : "bg-white/[0.03] text-zinc-600 cursor-not-allowed"
                        }`}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setSectionDocContent(savedContent);
                          setSectionDocEditing(false);
                        }}
                        className="px-3 py-1 rounded-lg text-xs border border-white/[0.07] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowSectionDoc(false)}
                    className="w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] flex items-center justify-center text-sm transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {sectionDocEditing ? (
                  <textarea
                    value={sectionDocContent}
                    onChange={(e) => setSectionDocContent(e.target.value)}
                    autoFocus
                    className={`w-full min-h-[500px] bg-white/[0.04] border ${currentSection.border} rounded-lg px-5 py-4 text-sm text-zinc-300 leading-relaxed focus:outline-none focus:bg-white/[0.06] transition-all resize-y font-mono`}
                  />
                ) : (
                  <div className={`rounded-lg p-5 border ${currentSection.border} ${currentSection.bg} min-h-[400px]`}>
                    <pre className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {sectionDocContent || <span className="text-zinc-600 italic">Click Edit to start writing your {currentSection.label.toLowerCase()} doc.</span>}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <header className="border-b border-white/[0.06] sticky top-0 bg-[rgba(7,7,15,0.85)] backdrop-blur-xl z-40">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link
            href={`/ads/campaign/${campaignId}`}
            className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            ← Back to {campaignName || "campaign"}
          </Link>
          <h1 className="text-xl font-semibold text-zinc-100 mt-1">
            📂 {wave.name} — Vault
          </h1>
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {SECTION_META.map((sec: (typeof SECTION_META)[number]) => {
              const isActive = activeSection === sec.type;
              const section = sectionFor(sec.type);
              const count = section
                ? childrenOf(section.id).length
                : 0;
              return (
                <button
                  key={sec.type}
                  onClick={() => setActiveSection(sec.type)}
                  className={`px-3 py-2 rounded-t-lg text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? `${sec.bg} ${sec.border} border border-b-0 ${sec.color} font-semibold`
                      : "text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-white/[0.02]"
                  }`}
                >
                  {sec.icon} {sec.label}
                  {count > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-white/10 text-white" : "bg-white/[0.05] text-zinc-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        <div
          className={`border rounded-xl p-4 ${currentSection.border} ${currentSection.bg} min-h-[400px]`}
        >
          {/* Quick add bar */}
          <div className="flex gap-2 mb-4">
            <input
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              placeholder={`Type a ${currentSection.singular.toLowerCase()} and press Enter…`}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.06] transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickAdd();
                }
              }}
            />
            <button
              onClick={handleQuickAdd}
              disabled={!quickAddText.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors text-white"
            >
              + Add
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] text-zinc-500">
              {currentSection.desc}
            </p>
            <button
              onClick={openSectionDoc}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${currentSection.border} ${currentSection.color} hover:bg-white/[0.04] transition-all flex items-center gap-1.5`}
            >
              📄 Docs
            </button>
          </div>

          {/* Items list */}
          {currentItems.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-3xl mb-3">{currentSection.icon}</div>
              <div className="text-sm text-zinc-500">
                No {currentSection.label.toLowerCase()} saved yet. Type
                one above and press Enter.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {currentItems.map((item) => {
                const text = getItemText(item);
                const isExpanded = expandedId === item.id;
                const copies = itemCopies[item.id] || [];

                return (
                  <div
                    key={item.id}
                    className="border border-white/[0.06] rounded-xl bg-white/[0.02] hover:bg-white/[0.03] transition-all overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm truncate max-w-[400px] text-zinc-300 cursor-pointer hover:${currentSection.color} transition-colors`}
                          title="Click to view full text"
                          onClick={() => openViewItem(item)}
                        >
                          {text}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {copies.length > 0 && !isExpanded && (
                            <div className="text-[10px] text-zinc-600">
                              📝 {copies.length} copy
                              {copies.length !== 1 ? "ies" : ""} attached
                            </div>
                          )}
                          <button
                            className="text-zinc-600 text-[10px] hover:text-zinc-400 transition-colors"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          >
                            {isExpanded ? "▼ collapse" : "▶ expand"}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <CopyBtn text={text} />
                        <button
                          onClick={() => openAdFromItem(item)}
                          className="px-2 py-1 rounded-lg text-[10px] bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                        >
                          + Card
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDeleteId(
                              confirmDeleteId === item.id
                                ? null
                                : item.id
                            )
                          }
                          className={`px-1.5 py-1 rounded-md text-[10px] border transition-all ${
                            confirmDeleteId === item.id
                              ? "bg-red-500/80 text-white border-red-500/40"
                              : "border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                          }`}
                        >
                          {confirmDeleteId === item.id ? "OK?" : "✕"}
                        </button>

                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-white/[0.05] px-4 py-3 space-y-3">
                        {/* Copy chips row */}
                        <div className="flex flex-wrap gap-1.5">
                          {copies.map((copy) => (
                            <div
                              key={copy.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-zinc-300"
                            >
                              <button
                                onClick={() =>
                                  openDocModal(item, copy)
                                }
                                className="text-[11px] truncate max-w-[130px] text-left hover:text-white transition-colors"
                              >
                                {copy.title}
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteCopy(
                                    copy.id,
                                    item.id
                                  )
                                }
                                className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => openDocModal(item, null)}
                            className="px-2 py-1 rounded-full border border-dashed border-white/[0.08] text-[11px] text-zinc-500 hover:text-sky-300 hover:border-sky-500/30 transition-all"
                          >
                            + Copy
                          </button>
                        </div>

                        {/* Meta badges */}
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          {item.desire &&
                            activeSection !== "desire" && (
                              <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-300 border border-orange-500/20">
                                Desire: {item.desire}
                              </span>
                            )}
                          {item.angle &&
                            activeSection !== "angle" && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Angle: {item.angle}
                              </span>
                            )}
                          {item.awareness && (
                            <span className="px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                              Awareness: {item.awareness}
                            </span>
                          )}
                          {item.format && (
                            <span className="px-2 py-0.5 rounded-md bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                              Format: {item.format}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <div className="text-[10px] text-zinc-500 italic">
                            📌 {item.notes}
                          </div>
                        )}

                        <div className="text-[9px] text-zinc-700">
                          Added{" "}
                          {new Date(
                            item.createdAt
                          ).toLocaleDateString()}
                        </div>

                        {/* Confirm delete row */}
                        {confirmDeleteId === item.id && (
                          <div className="pt-2 border-t border-white/[0.05] mt-2 text-[11px] text-red-400">
                            This will delete this{" "}
                            {currentSection.singular.toLowerCase()}{" "}
                            and its copies.
                            <div className="mt-1 flex gap-2">
                              <button
                                onClick={() =>
                                  handleDeleteItem(item.id)
                                }
                                className="px-3 py-1 rounded-lg bg-red-500/80 text-white text-[11px] hover:bg-red-500 transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmDeleteId(null)
                                }
                                className="px-3 py-1 rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-400 text-[11px] hover:text-zinc-200 transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
