import { NextRequest, NextResponse } from "next/server";

type SearchType = "howto" | "where";

const MODE_KEYWORDS: Record<SearchType, string[]> = {
  howto: ["how", "craft", "build", "farm", "route", "method", "loop", "efficient", "best", "guide"],
  where: ["where", "find", "location", "planet", "system", "station", "spawn", "drop", "vendor"],
};

const META_TITLE_KEYWORDS = [
  "expedition",
  "update",
  "review",
  "screenshot",
  "photo",
  "showcase",
  "trailer",
  "impressions",
];

type VideoClip = {
  mode: "storyboard";
  title: string;
  note: string;
  segments: Array<{
    label: string;
    detail: string;
  }>;
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

type RedditListingResponse = {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        subreddit_name_prefixed?: string;
        author?: string;
        score?: number;
        num_comments?: number;
        permalink?: string;
      };
    }>;
  };
};

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeForMatch(value)
    .split(" ")
    .filter((token) => token.length > 1)
    .map((token) => {
      if (token.length > 4 && token.endsWith("es")) {
        return token.slice(0, -2);
      }
      if (token.length > 3 && token.endsWith("s")) {
        return token.slice(0, -1);
      }
      return token;
    });
}

function stripExternalLinks(value: string): string {
  return value
    .replace(/\[[^\]]+\]\((?:https?:\/\/|www\.)[^)]+\)/gi, "")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: string): string {
  return stripExternalLinks(value)
    .replace(/&amp;/g, "&")
    .replace(/[*_`>#~]+/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function polishSentence(value: string): string {
  return cleanText(value)
    .replace(/[|]+/g, " ")
    .replace(/\s*[-–—]{2,}\s*/g, " - ")
    .replace(/([!?.,])\1{1,}/g, "$1")
    .replace(/\s+([!?.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(value: string): string[] {
  return polishSentence(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => polishSentence(sentence))
    .filter((sentence) => sentence.length > 0);
}

function pickBestSentences(
  sentences: string[],
  keywordGroups: string[][],
  fallback: string,
  count: number,
): string[] {
  const ranked = sentences
    .map((sentence) => {
      const normalized = normalizeForMatch(sentence);
      const score = keywordGroups.reduce((sum, group) => {
        const groupMatch = group.some((keyword) => normalized.includes(keyword));
        return sum + (groupMatch ? 1 : 0);
      }, 0);
      return { sentence, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((item, index) => item.score > 0 || index < count)
    .slice(0, count)
    .map((item) => item.sentence);

  return ranked.length > 0 ? ranked : [fallback];
}

function sanitizeTitle(value: string, query: string): string {
  const cleaned = polishSentence(value);
  if (cleaned.length > 0) {
    return cleaned;
  }

  return `Community result for ${query}`;
}

function countTokenOverlap(text: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const tokenSet = new Set(tokenize(text));
  return queryTokens.reduce((sum, token) => sum + (tokenSet.has(token) ? 1 : 0), 0);
}

function countKeywordHits(text: string, keywords: string[]): number {
  if (keywords.length === 0) {
    return 0;
  }

  const tokenSet = new Set(tokenize(text));
  return keywords.reduce((sum, token) => sum + (tokenSet.has(token) ? 1 : 0), 0);
}

function hasNmsContext(post: { title?: string; selftext?: string; subreddit_name_prefixed?: string }): boolean {
  const context = normalizeForMatch(
    `${post.title ?? ""} ${post.selftext ?? ""} ${post.subreddit_name_prefixed ?? ""}`,
  );

  return ["no man s sky", "nomanssky", "nms", "anomaly", "sentinel", "atlas"].some((keyword) =>
    context.includes(keyword),
  );
}

function scoreRedditPost(
  post: { title?: string; selftext?: string; subreddit_name_prefixed?: string; score?: number; num_comments?: number },
  queryTokens: string[],
  type: SearchType,
): number {
  const title = cleanText(post.title ?? "");
  const body = cleanText(post.selftext ?? "");
  const overlapInTitle = countTokenOverlap(title, queryTokens);
  const overlapInBody = countTokenOverlap(body, queryTokens);
  const modeHitInTitle = countKeywordHits(title, MODE_KEYWORDS[type]);
  const modeHitInBody = countKeywordHits(body, MODE_KEYWORDS[type]);
  const engagement = Math.log10(Math.max((post.score ?? 0) + (post.num_comments ?? 0), 1) + 1);
  const hasBody = body.length >= 60 ? 1 : 0;
  const nmsBoost = hasNmsContext(post) ? 2 : 0;
  const metaHits = countKeywordHits(title, META_TITLE_KEYWORDS);
  const queryLooksMeta = queryTokens.some((token) => META_TITLE_KEYWORDS.includes(token));
  const metaPenalty = metaHits > 0 && !queryLooksMeta ? 4 : 0;

  return (
    overlapInTitle * 10 +
    overlapInBody * 4 +
    modeHitInTitle * 3 +
    modeHitInBody * 1.5 +
    engagement * 2 +
    hasBody +
    nmsBoost -
    metaPenalty
  );
}

async function fetchRedditPosts(query: string): Promise<RedditListingResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const params = new URLSearchParams({
      q: query,
      sort: "relevance",
      t: "year",
      limit: "24",
      restrict_sr: "on",
      include_over_18: "off",
      raw_json: "1",
    });

    const response = await fetch(`https://www.reddit.com/r/NoMansSkyTheGame/search.json?${params.toString()}`, {
      headers: {
        "User-Agent": "nms-companion/0.1 (live-search)",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {};
    }

    return (await response.json()) as RedditListingResponse;
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

function toSearchResultFromReddit(
  post: NonNullable<NonNullable<RedditListingResponse["data"]>["children"]>[number]["data"],
  query: string,
  type: SearchType,
): SearchResult {
  const title = sanitizeTitle(post?.title ?? "", query);
  const body = polishSentence(post?.selftext ?? "");
  const allText = polishSentence(`${title}. ${body}`);
  const sentences = splitSentences(allText);

  const whereLines = pickBestSentences(
    sentences,
    [
      ["where", "find", "found", "location", "planet", "system", "station", "biome"],
      ["farm", "drop", "spawn", "sentinel", "anomaly", "vendor", "market"],
    ],
    "Community reports suggest checking mission hubs, planets matching the resource biome, and station trade loops.",
    2,
  );

  const howLines = pickBestSentences(
    sentences,
    [
      ["how", "use", "craft", "build", "route", "method", "loop"],
      ["tip", "best", "fast", "efficient", "priority", "upgrade"],
    ],
    "Community advice generally favors repeatable loops, inventory prep, and stacking compatible mission objectives.",
    2,
  );

  const tipCandidates = pickBestSentences(
    sentences,
    [["tip", "best", "fast", "efficient", "carry", "stack", "prioritize", "avoid"]],
    "Keep route loops short and inventory space ready for faster farming cycles.",
    3,
  );

  const summary = polishSentence(type === "where" ? whereLines[0] : howLines[0]);
  const details = [
    `Where to find: ${whereLines.join(" ")}`,
    `How to use: ${howLines.join(" ")}`,
    "Tips:",
    ...tipCandidates.map((tip) => `- ${polishSentence(tip)}`),
  ].join("\n");

  const subreddit = cleanText(post?.subreddit_name_prefixed ?? "r/NoMansSkyTheGame") || "r/NoMansSkyTheGame";
  const author = cleanText(post?.author ?? "unknown");
  const score = typeof post?.score === "number" ? post.score : 0;
  const comments = typeof post?.num_comments === "number" ? post.num_comments : 0;

  return {
    id: `reddit-${post?.id ?? normalizeForMatch(title).replace(/\s+/g, "-")}`,
    title,
    summary,
    details,
    source: "Live Community Search",
    references: [
      `Source set: Reddit live snapshot`,
      `Forum: ${subreddit}`,
      `Engagement: score ${score}, comments ${comments}`,
    ],
    redditNotes: [
      `Author: u/${author}`,
      "External URLs are intentionally removed from this app output.",
    ],
    faq: [
      {
        question: `How current is this guidance for ${query}?`,
        answer: "It is compiled from live community posts at request time and summarized in-app without outbound links.",
      },
    ],
  };
}

function buildNoMatchResult(query: string, type: SearchType): SearchResult {
  const modeLabel = type === "where" ? "where-to-find" : "how-to";
  return {
    id: `no-match-${normalizeForMatch(query).replace(/\s+/g, "-") || "query"}`,
    title: `No live community match for "${query}" yet`,
    summary: "Try fewer words, singular terms, or the base material/item name.",
    details: [
      "Live search returned no strong match in this pass.",
      `Mode used: ${modeLabel}.`,
      "Suggested next tries:",
      '- Use a compact term (example: "radiant heart" instead of full sentence).',
      "- Try item, then process (example: nanites, then nanite farm).",
      "- Ask a follow-up in this card and refine step-by-step.",
    ].join("\n"),
    source: "Live Community Search",
    references: ["Live snapshot only"],
    redditNotes: ["Community data may be available on retry; all external links are removed by design."],
    faq: [
      {
        question: "Can this still use Reddit data without links?",
        answer: "Yes. Results can include Reddit-derived summaries while hiding outbound URLs.",
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
  const queryTokens = tokenize(query);

  const redditPayload = await fetchRedditPosts(query);
  const dedupedRanked = (redditPayload.data?.children ?? [])
    .map((child) => child.data)
    .filter((post): post is NonNullable<typeof post> => Boolean(post?.id && post?.title))
    .map((post) => ({
      post,
      qualityScore: scoreRedditPost(post, queryTokens, type),
      overlapTitle: countTokenOverlap(post.title ?? "", queryTokens),
      overlap: countTokenOverlap(`${post.title ?? ""} ${post.selftext ?? ""}`, queryTokens),
    }))
    .filter((item) => {
      if (queryTokens.length === 0) {
        return true;
      }

      const minCoverage = Math.max(1, Math.ceil(queryTokens.length * 0.5));
      const hasStrongCoverage = item.overlap >= minCoverage;
      const hasTitleHit = item.overlapTitle >= 1;
      const hasUsefulSignal = item.qualityScore >= 7;

      if (queryTokens.length === 1) {
        return hasTitleHit && hasUsefulSignal;
      }

      const hasTitleOrVeryStrongBody = hasTitleHit || item.overlap >= minCoverage + 1;
      return hasStrongCoverage && hasTitleOrVeryStrongBody && hasUsefulSignal && hasTitleHit;
    })
    .sort((left, right) => right.qualityScore - left.qualityScore)
    .filter((item, index, all) => {
      const normalizedTitle = normalizeForMatch(item.post.title ?? "");
      if (!normalizedTitle) {
        return index === 0;
      }

      return all.findIndex((entry) => normalizeForMatch(entry.post.title ?? "") === normalizedTitle) === index;
    });

  const redditResults = dedupedRanked
    .slice(0, 8)
    .map((item) => toSearchResultFromReddit(item.post, query, type));

  const results = redditResults.length > 0 ? redditResults : [buildNoMatchResult(query, type)];

  return NextResponse.json({
    query,
    type,
    results,
  });
}
