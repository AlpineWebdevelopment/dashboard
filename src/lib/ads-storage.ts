import type {
  Campaign,
  Ad,
  AwarenessLevel,
  TestFocus,
  FormatType,
  CboWave,
  CboPhase,
  CboFolder,
  CboItemCopy,
} from "@/types/ads";

async function api(action: string, params: any = {}) {
  const res = await fetch("/api/ads/supabase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "API error");
  return json.data;
}

// ─── Campaign helpers ───

export async function getCampaigns(): Promise<Campaign[]> {
  const data = await api("getCampaigns");
  if (!data) return [];
  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    niche: row.niche,
    ads: [],
    createdAt: row.created_at,
  }));
}

export async function saveCampaign(c: Campaign): Promise<Campaign> {
  const data = await api("saveCampaign", {
    payload: { name: c.name, niche: c.niche, created_at: c.createdAt },
  });
  return {
    id: data.id,
    name: data.name,
    niche: data.niche,
    ads: [],
    createdAt: data.created_at,
  };
}

export async function saveCampaigns(campaigns: Campaign[]): Promise<Campaign[]> {
  if (campaigns.length === 0) return campaigns;
  const last = campaigns[campaigns.length - 1];
  const saved = await saveCampaign(last);
  return [...campaigns.slice(0, -1), saved];
}

export async function deleteCampaign(id: string): Promise<void> {
  await api("deleteCampaignCascade", { campaignId: id });
}

// ─── Ad helpers ───

export async function fetchCampaignWithAds(id: string): Promise<Campaign | null> {
  let campaignRow: any;
  try {
    campaignRow = await api("fetchCampaign", { id });
  } catch {
    return null;
  }
  if (!campaignRow) return null;

  const adRows = await api("fetchAds", { id });
  const ads: Ad[] =
    adRows?.map((row: any) => ({
      id: row.id,
      name: row.name,
      desire: row.desire,
      angle: row.angle,
      waveId: row.wave_id || null,
      awareness: row.awareness as AwarenessLevel,
      targetAvatar: row.target_avatar ?? "",
      notes: row.notes ?? "",
      format: (row.format ?? "UGC") as FormatType,
      testFocus: (row.test_focus ?? "desire") as TestFocus,
      status: row.status,
      parentId: row.parent_id ?? undefined,
      createdAt: row.created_at,
      duration: row.duration ?? 7,
    })) ?? [];

  return {
    id: campaignRow.id,
    name: campaignRow.name,
    niche: campaignRow.niche,
    ads,
    createdAt: campaignRow.created_at,
  };
}

export async function insertAd(campaignId: string, payload: {
  name: string; desire: string; angle: string; awareness: AwarenessLevel;
  targetAvatar?: string;
  notes?: string; format: FormatType; testFocus: TestFocus;
  status: string; parentId?: string; createdAt?: string; duration: number;
  waveId?: string | null;
}): Promise<string> {
  const data = await api("insertAd", {
    payload: {
      campaign_id: campaignId,
      wave_id: payload.waveId || null,
      name: payload.name, desire: payload.desire, angle: payload.angle,
      awareness: payload.awareness,
      target_avatar: payload.targetAvatar || "",
      notes: payload.notes || "",
      format: payload.format, test_focus: payload.testFocus,
      status: payload.status, parent_id: payload.parentId || null,
      created_at: payload.createdAt || new Date().toISOString(),
      duration: payload.duration,
    },
  });
  return data.id;
}

export async function updateAd(ad: Ad): Promise<void> {
  await api("rpc", {
    fn: "update_ad",
    args: {
      ad_id: ad.id,
      ad_name: ad.name,
      ad_desire: ad.desire,
      ad_angle: ad.angle,
      ad_awareness: ad.awareness,
      ad_target_avatar: ad.targetAvatar ?? "",
      ad_notes: ad.notes,
      ad_format: ad.format,
      ad_test_focus: ad.testFocus,
      ad_status: ad.status,
      ad_parent_id: ad.parentId ?? null,
      ad_duration: ad.duration,
      ad_created_at: ad.createdAt,
    },
  });
}

export async function setAdStatus(adId: string, status: string): Promise<void> {
  await api("rpc", { fn: "set_ad_status", args: { ad_id: adId, new_status: status } });
}

export async function deleteAdWithVariants(adId: string): Promise<void> {
  await api("rpc", { fn: "delete_ad_with_variants", args: { ad_id: adId } });
}

export async function deleteSingleAd(adId: string): Promise<void> {
  await api("rpc", { fn: "delete_single_ad", args: { ad_id: adId } });
}

// ─── CBO Wave helpers ───

function mapPhase(row: any): CboPhase {
  return {
    id: row.id,
    waveId: row.wave_id,
    type: row.type,
    position: row.position,
    status: row.status,
    winnerAds: row.winner_ads ?? [],
    notes: row.notes ?? "",
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
  };
}

export async function fetchWaves(campaignId: string): Promise<CboWave[]> {
  const waves = await api("fetchWaves", { campaignId });
  if (!waves || waves.length === 0) return [];

  const waveIds = waves.map((w: any) => w.id);
  const phases = await api("fetchAllPhases", { waveIds });

  const phasesByWave: Record<string, CboPhase[]> = {};
  for (const p of phases || []) {
    const mapped = mapPhase(p);
    if (!phasesByWave[mapped.waveId]) phasesByWave[mapped.waveId] = [];
    phasesByWave[mapped.waveId].push(mapped);
  }

  return waves.map((w: any) => ({
    id: w.id,
    campaignId: w.campaign_id,
    name: w.name,
    status: w.status,
    phases: (phasesByWave[w.id] || []).sort((a: CboPhase, b: CboPhase) => a.position - b.position),
    createdAt: w.created_at,
  }));
}

export async function createWave(campaignId: string, name: string): Promise<string> {
  const data = await api("rpc", {
    fn: "create_cbo_wave",
    args: { p_campaign_id: campaignId, p_name: name },
  });
  return data;
}

export async function updatePhase(
  phaseId: string,
  status: string,
  winnerAds: string[],
  notes: string
): Promise<void> {
  await api("rpc", {
    fn: "update_cbo_phase",
    args: {
      p_phase_id: phaseId,
      p_status: status,
      p_winner_ads: winnerAds,
      p_notes: notes,
    },
  });
}

export async function deleteWave(waveId: string): Promise<void> {
  await api("rpc", { fn: "delete_cbo_wave", args: { p_wave_id: waveId } });
}

export async function updateWaveStatus(waveId: string, status: string): Promise<void> {
  await api("rpc", { fn: "update_cbo_wave_status", args: { p_wave_id: waveId, p_status: status } });
}

export async function fetchFolders(waveId: string): Promise<CboFolder[]> {
  const data = await api("fetchFolders", { waveId });
  return (data || []).map((row: any) => ({
    id: row.id,
    waveId: row.wave_id,
    parentId: row.parent_id,
    name: row.name,
    type: row.type,
    desire: row.desire,
    angle: row.angle,
    awareness: row.awareness,
    format: row.format,
    content: row.content,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export async function insertFolder(payload: {
  waveId: string;
  parentId: string | null;
  name: string;
  type: string;
  desire?: string;
  angle?: string;
  awareness?: string;
  format?: string;
  content?: string;
  notes?: string;
}): Promise<CboFolder> {
  const data = await api("insertFolder", {
    payload: {
      wave_id: payload.waveId,
      parent_id: payload.parentId,
      name: payload.name,
      type: payload.type,
      desire: payload.desire,
      angle: payload.angle,
      awareness: payload.awareness,
      format: payload.format,
      content: payload.content,
      notes: payload.notes,
    },
  });
  return {
    id: data.id,
    waveId: data.wave_id,
    parentId: data.parent_id,
    name: data.name,
    type: data.type,
    desire: data.desire,
    angle: data.angle,
    awareness: data.awareness,
    format: data.format,
    content: data.content,
    notes: data.notes,
    createdAt: data.created_at,
  };
}

export async function deleteFolder(folderId: string): Promise<void> {
  await api("deleteFolder", { id: folderId });
}

export async function updateFolder(
  folderId: string,
  payload: Partial<{
    name: string;
    desire: string;
    angle: string;
    awareness: string;
    format: string;
    content: string;
    notes: string;
  }>
): Promise<void> {
  await api("updateFolder", { id: folderId, payload });
}

export async function fetchItemCopies(folderId: string): Promise<CboItemCopy[]> {
  const data = await api("fetchItemCopies", { folderId });
  return (data || []).map((row: any) => ({
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function insertItemCopy(payload: {
  folderId: string;
  title: string;
  content: string;
}): Promise<CboItemCopy> {
  const data = await api("insertItemCopy", {
    payload: {
      folder_id: payload.folderId,
      title: payload.title,
      content: payload.content,
    },
  });
  return {
    id: data.id,
    folderId: data.folder_id,
    title: data.title,
    content: data.content,
    createdAt: data.created_at,
  };
}

export async function updateItemCopy(
  id: string,
  payload: Partial<{ title: string; content: string }>
) {
  await api("updateItemCopy", { id, payload });
}

export async function deleteItemCopy(id: string) {
  await api("deleteItemCopy", { id });
}

export async function attachCopiesToAd(adId: string, copyIds: string[]): Promise<void> {
  if (!copyIds.length) return;
  await api("insertAdCopies", {
    rows: copyIds.map((cid) => ({ ad_id: adId, copy_id: cid })),
  });
}

export async function fetchAdCopies(adId: string): Promise<CboItemCopy[]> {
  const data = await api("fetchAdCopies", { adId });
  return (data || []).map((row: any) => ({
    id: row.cbo_item_copies.id,
    folderId: row.cbo_item_copies.folder_id,
    title: row.cbo_item_copies.title,
    content: row.cbo_item_copies.content,
    createdAt: row.cbo_item_copies.created_at,
  }));
}
