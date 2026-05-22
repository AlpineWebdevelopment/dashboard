export type Niche = "Pet" | "Health" | "Beauty" | "Babies" | "Tech Gadgets";
export const NICHES: Niche[] = ["Pet", "Health", "Beauty", "Babies", "Tech Gadgets"];

export type AwarenessLevel =
  | "Unaware"
  | "Problem aware"
  | "Solution aware"
  | "Product aware"
  | "Most aware"
  | "Other";

export type TestFocus =
  | "desire"
  | "angle"
  | "awareness"
  | "advertorial"
  | "pricing"
  | "format";

export type FormatType =
  | "Native Image"
  | "Static"
  | "UGC"
  | "AI Vid"
  | "VSL"
  | "Slideshow"
  | "Carousel"
  | "Story"
  | "Other";

export const FORMATS: FormatType[] = [
  "Native Image", "Static", "UGC", "AI Vid", "VSL",
  "Slideshow", "Carousel", "Story", "Other",
];

export type ConceptType =
  | "Advertorial"
  | "Curiosity"
  | "Pain / Problem"
  | "Story"
  | "Social Proof"
  | "Authority"
  | "How-To"
  | "Controversial"
  | "News Style"
  | "Direct Offer"
  | "Other";

export const CONCEPTS: ConceptType[] = [
  "Advertorial",
  "Curiosity",
  "Pain / Problem",
  "Story",
  "Social Proof",
  "Authority",
  "How-To",
  "Controversial",
  "News Style",
  "Direct Offer",
  "Other",
];

export const conceptEmojis: Record<ConceptType, string> = {
  "Advertorial":    "📰",
  "Curiosity":      "🔍",
  "Pain / Problem": "😣",
  "Story":          "📖",
  "Social Proof":   "⭐",
  "Authority":      "🎓",
  "How-To":         "📋",
  "Controversial":  "🔥",
  "News Style":     "📡",
  "Direct Offer":   "💰",
  "Other":          "📌",
};

export interface MetaInsights {
  impressions: string;
  reach: string;
  linkClicks: string;
  ctr: string;              // link CTR %
  ctrAll: string | null;    // all-click CTR %
  spend: string;            // total spend in account currency
  costPerClick: string | null;
  costPerResult: string | null;
  landingPageViews: string | null;
  updatedAt?: string;
}

export interface Ad {
  id: string;
  campaignId?: string;
  waveId?: string | null;
  name: string;
  concept: ConceptType;
  massDesire: string;
  pricingOffer: string;
  desire: string;
  angle: string;
  awareness: AwarenessLevel;
  targetAvatar: string;
  notes: string;
  format: FormatType;
  testFocus: TestFocus;
  status: "testing" | "winner" | "loser";
  parentId?: string;
  createdAt: string;
  duration: number;
  metaAdId?: string | null;
  metaAdsetId?: string | null;
  metaAdsetName?: string | null;
  metaInsights?: MetaInsights | null;
}

export const AWARENESS_TEST_LEVELS: AwarenessLevel[] = [
  "Unaware",
  "Problem aware",
  "Solution aware",
  "Product aware",
  "Most aware",
];

export interface Campaign {
  id: string;
  name: string;
  niche: Niche;
  ads: Ad[];
  createdAt: string;
}

export interface CboPhase {
  id: string;
  waveId: string;
  type: "desire" | "angle" | "awareness" | "advertorial" | "format";
  position: number;
  status: "pending" | "running" | "done";
  winnerAds: string[];
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CboWave {
  id: string;
  campaignId: string;
  name: string;
  status: "active" | "completed" | "archived";
  phases: CboPhase[];
  createdAt: string;
}

export interface CboFolder {
  id: string;
  waveId: string;
  parentId: string | null;
  name: string;
  type: "root" | "desire" | "angle" | "awareness" | "combo" | "copy" | "other";
  desire?: string | null;
  angle?: string | null;
  awareness?: string | null;
  format?: string | null;
  content?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CboItemCopy {
  id: string;
  folderId: string;
  title: string;
  content: string;
  createdAt: string;
}

export const nicheEmojis: { [key: string]: string } = {
  Pet: "🐾",
  Health: "💪",
  Beauty: "✨",
  Babies: "👶",
  "Tech Gadgets": "📱",
};
