import { NextRequest, NextResponse } from "next/server";

type SearchType = "howto" | "where";

type VideoClip = {
  mode: "storyboard";
  title: string;
  note: string;
  segments: Array<{
    label: string;
    detail: string;
  }>;
};

type KnowledgeEntry = {
  id: string;
  title: string;
  aliases: string[];
  whereToFind: string;
  howToUse: string;
  tips: string[];
  references: string[];
  redditNotes: string[];
  faq: Array<{ question: string; answer: string }>;
  video?: VideoClip;
};

type SearchResult = {
  id: string;
  title: string;
  summary: string;
  details: string;
  source: string;
  references: string[];
  redditNotes: string[];
  faq: Array<{ question: string; answer: string }>;
  video?: VideoClip;
};

const LOCAL_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "radiant-heart",
    title: "Radiant Heart",
    aliases: ["radiant heart", "radiant hearts", "sentinel heart"],
    whereToFind:
      "Radiant Hearts are commonly earned from Sentinel combat loops, especially in corrupted zones and high-alert Sentinel areas.",
    howToUse:
      "Used in advanced crafting and upgrade paths tied to Sentinel-related technology and high-tier progression components.",
    tips: [
      "Use a Sentinel Pillar area as a repeatable combat route.",
      "Carry ammo and shield recharge so you can farm multiple waves in one run.",
      "Deposit rare drops often if inventory is tight.",
    ],
    references: ["No Man's Sky Wiki (internal summary)", "Community route notes (internal summary)"],
    redditNotes: [
      "Players often report best drop consistency from sustained Sentinel wave clears.",
      "Many community routes pair Sentinel farms with nearby salvage stops.",
    ],
    faq: [
      {
        question: "What is the fastest way to farm Radiant Hearts?",
        answer:
          "A strong loop is repeating Sentinel wave combat near a Pillar, collecting drops, then resetting at another hotspot.",
      },
      {
        question: "Do I need a specific biome for Radiant Hearts?",
        answer:
          "Not strictly, but corrupted or high-Sentinel-pressure zones usually feel most consistent.",
      },
    ],
    video: {
      mode: "storyboard",
      title: "Sentinel farming route example",
      note:
        "In-app storyboard guide. No external video service required.",
      segments: [
        {
          label: "00:00 - Prep",
          detail: "Land near a Sentinel Pillar, reload ammo, and verify shield recharge supply.",
        },
        {
          label: "00:40 - Trigger",
          detail: "Start Sentinel engagement and maintain line-of-sight control instead of over-chasing.",
        },
        {
          label: "01:30 - Collect",
          detail: "Sweep drops between waves and keep one free inventory row for fast looting.",
        },
        {
          label: "02:20 - Reset Loop",
          detail: "Move to the next nearby hotspot and repeat for consistent Radiant Heart farming.",
        },
      ],
    },
  },
  {
    id: "living-glass",
    title: "Living Glass",
    aliases: ["living glass", "lg", "farm income"],
    whereToFind:
      "Living Glass is usually crafted from plant-chain materials rather than found as a frequent raw pickup.",
    howToUse:
      "Useful as a reliable mid-game money craft and for select blueprint requirements.",
    tips: [
      "Automate farm ingredients with biodomes or hydroponics.",
      "Craft in batches after each harvest cycle.",
      "Keep a dedicated storage tab for farm chain materials.",
    ],
    references: ["No Man's Sky crafting chain notes (internal summary)"],
    redditNotes: [
      "Community posts frequently suggest Living Glass as a safe early passive income path.",
    ],
    faq: [
      {
        question: "Is Living Glass better than random loot selling?",
        answer:
          "For many players, yes. A stable farm chain can outperform random loot runs in consistency.",
      },
    ],
    video: {
      mode: "storyboard",
      title: "Living Glass farm layout walkthrough",
      note: "In-app storyboard guide. No external video service required.",
      segments: [
        {
          label: "00:00 - Base Layout",
          detail: "Place biodomes/hydroponics in a tight loop near refiners and storage.",
        },
        {
          label: "00:45 - Crop Balance",
          detail: "Balance ingredient crops by bottleneck material rather than equal count.",
        },
        {
          label: "01:20 - Batch Craft",
          detail: "Harvest all, craft components first, then final Living Glass in one pass.",
        },
      ],
    },
  },
  {
    id: "oxygen",
    title: "Oxygen",
    aliases: ["oxygen", "o2", "life support"],
    whereToFind:
      "Gather from oxygen-rich flora, gas hotspots, and occasional market supply.",
    howToUse:
      "Core utility resource for life support and several refining chains.",
    tips: [
      "Set up an oxygen extractor base as early infrastructure.",
      "Carry backup oxygen stacks before long expeditions.",
    ],
    references: ["Resource gathering notes (internal summary)"],
    redditNotes: ["Players commonly prioritize oxygen extraction as an early QoL base."],
    faq: [
      {
        question: "Should I buy oxygen or farm it?",
        answer:
          "Buying is fine short-term, but farming becomes more efficient once your base is established.",
      },
    ],
  },
  {
    id: "sodium",
    title: "Sodium",
    aliases: ["sodium", "hazard protection", "yellow plants"],
    whereToFind:
      "Readily harvested from yellow flora on many planets and sometimes purchased at stations or pilots.",
    howToUse:
      "Primary hazard protection refill material.",
    tips: [
      "Keep one dedicated sodium stack in exosuit inventory at all times.",
      "Convert to Sodium Nitrate when needed for stronger refills.",
    ],
    references: ["Survival resource notes (internal summary)"],
    redditNotes: ["New-player guides repeatedly emphasize sodium as top-priority carry material."],
    faq: [
      {
        question: "How much sodium should I carry?",
        answer:
          "At least one full stack for exploration-heavy sessions, more for harsh biomes.",
      },
    ],
  },
  {
    id: "salvaged-data",
    title: "Salvaged Data",
    aliases: ["salvaged data", "technology modules", "buried tech"],
    whereToFind:
      "Dig up buried technology modules using the Analysis Visor and Terrain Manipulator.",
    howToUse:
      "Spent at the Space Anomaly construction terminal to unlock base parts and tech.",
    tips: [
      "Scan while moving in a wide loop to chain buried tech finds quickly.",
      "Prioritize unlocks that improve power, storage, and farming first.",
    ],
    references: ["Base progression notes (internal summary)"],
    redditNotes: ["Community consensus: early Salvaged Data routes accelerate base progression heavily."],
    faq: [
      {
        question: "What should I unlock first with Salvaged Data?",
        answer:
          "Most players prioritize power generation, storage, and farming modules first.",
      },
    ],
  },
  {
    id: "nanites",
    title: "Nanites",
    aliases: ["nanites", "nanite clusters", "upgrade currency"],
    whereToFind:
      "Earned from scanning, missions, refining loops, and selling discovered data sources.",
    howToUse:
      "Main currency for tech upgrades and class improvements.",
    tips: [
      "Stack mission board tasks that reward nanites.",
      "Use steady micro-loops instead of waiting for one big source.",
    ],
    references: ["Upgrade currency notes (internal summary)"],
    redditNotes: ["Frequent player advice is to combine mission rewards with refining side loops."],
    faq: [
      {
        question: "What is a beginner-friendly nanite loop?",
        answer:
          "Combine station missions with fast scan/refine cycles so progress continues while traveling.",
      },
    ],
  },
];

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeForMatch(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function scoreEntry(entry: KnowledgeEntry, query: string): number {
  const normalizedQuery = normalizeForMatch(query);
  const queryTokens = tokenize(query);
  let score = 0;

  if (normalizeForMatch(entry.title) === normalizedQuery) {
    score += 120;
  }

  for (const alias of entry.aliases) {
    const normalizedAlias = normalizeForMatch(alias);
    if (normalizedQuery.includes(normalizedAlias)) {
      score += 80;
    }
  }

  const searchable = `${entry.title} ${entry.aliases.join(" ")} ${entry.whereToFind} ${entry.howToUse} ${entry.tips.join(" ")}`;
  const searchableTokens = tokenize(searchable);

  for (const token of queryTokens) {
    if (searchableTokens.includes(token)) {
      score += 12;
    }
  }

  return score;
}

function toSearchResult(entry: KnowledgeEntry, type: SearchType): SearchResult {
  const summary = type === "where" ? entry.whereToFind : entry.howToUse;
  const details = [
    `Where to find: ${entry.whereToFind}`,
    `How to use: ${entry.howToUse}`,
    "Tips:",
    ...entry.tips.map((tip) => `- ${tip}`),
  ].join("\n");

  return {
    id: entry.id,
    title: entry.title,
    summary,
    details,
    source: "NMS Local KB",
    references: entry.references,
    redditNotes: entry.redditNotes,
    faq: entry.faq,
    video: entry.video,
  };
}

function buildNoMatchResult(query: string, type: SearchType): SearchResult {
  const modeLabel = type === "where" ? "where-to-find" : "how-to";
  return {
    id: `no-match-${normalizeForMatch(query).replace(/\s+/g, "-") || "query"}`,
    title: `No exact local match for "${query}" yet`,
    summary: "Try a shorter name, singular form, or a nearby material/blueprint term.",
    details: [
      `The app is in local-only mode, so it only searches built-in data.`,
      `Mode used: ${modeLabel}.`,
      "Suggested next tries:",
      "- Remove extra words (example: use \"radiant heart\" instead of full sentence).",
      "- Search by ingredient or output item.",
      "- Ask a follow-up question in this card so the app can guide alternatives.",
    ].join("\n"),
    source: "NMS Local KB",
    references: ["Local knowledge base only"],
    redditNotes: ["Reddit references are summarized in-app only; no outbound links are provided."],
    faq: [
      {
        question: "Can I still use Reddit info without opening Reddit?",
        answer: "Yes. The app can include summarized Reddit-derived notes inside result details.",
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const typeParam = request.nextUrl.searchParams.get("type");

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const type: SearchType = typeParam === "where" ? "where" : "howto";

  const scored = LOCAL_KNOWLEDGE.map((entry) => ({
    entry,
    score: scoreEntry(entry, query),
  }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map((item) => toSearchResult(item.entry, type));

  const results = scored.length > 0 ? scored : [buildNoMatchResult(query, type)];

  return NextResponse.json({
    query,
    type,
    results,
  });
}
