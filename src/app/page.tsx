"use client";

import { useEffect, useMemo, useState } from "react";

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

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const FAVORITES_STORAGE_KEY = "nms-companion-favorites";

function getResultKey(result: SearchResult): string {
  return `${result.source}::${result.id}`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function keywordOverlap(a: string, b: string): number {
  const left = new Set(normalize(a).split(" ").filter((token) => token.length > 1));
  const right = new Set(normalize(b).split(" ").filter((token) => token.length > 1));
  let score = 0;

  for (const token of left) {
    if (right.has(token)) {
      score += 1;
    }
  }

  return score;
}

function buildFollowUpAnswer(result: SearchResult, question: string, history: ChatMessage[]): string {
  const q = normalize(question);
  const hasPriorQuestions = history.some((message) => message.role === "user");

  if (q.includes("where") || q.includes("find") || q.includes("location")) {
    return `Where-to-find summary:\n${result.details.split("\n")[0]}`;
  }

  if (q.includes("how") || q.includes("use") || q.includes("craft") || q.includes("build")) {
    const howLine = result.details
      .split("\n")
      .find((line) => line.toLowerCase().startsWith("how to use:"));
    return howLine ?? "This entry includes how-to guidance in the details section above.";
  }

  if (q.includes("tip") || q.includes("best") || q.includes("fast") || q.includes("efficient")) {
    const tipLines = result.details
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .slice(0, 2);
    if (tipLines.length > 0) {
      return `Top tips:\n${tipLines.join("\n")}`;
    }
  }

  if (q.includes("reddit")) {
    if (result.redditNotes.length === 0) {
      return "This entry has no Reddit-derived notes yet.";
    }

    return `Reddit references are summarized in-app only:\n${result.redditNotes
      .map((note) => `- ${note}`)
      .join("\n")}`;
  }

  if (q.includes("video") || q.includes("watch")) {
    if (result.video) {
      return "Open the video guide section in this card. It uses a local storyboard format and stays fully in-app.";
    }

    return "This entry does not have a curated video clip yet, but I can still help with text guidance from this card.";
  }

  const bestFaq = result.faq
    .map((item) => ({
      item,
      score: keywordOverlap(question, item.question),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (bestFaq && bestFaq.score > 0) {
    return bestFaq.item.answer;
  }

  const references = result.references.length > 0 ? `\n\nReference notes:\n- ${result.references.join("\n- ")}` : "";
  const followUpPrompt = hasPriorQuestions
    ? "If you want, ask a narrower follow-up (example: fastest route, required gear, or inventory prep)."
    : "Ask another question about route, gear prep, or quickest method and I’ll narrow this down.";

  return `From this result:\n${result.summary}${references}\n\n${followUpPrompt}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("howto");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [favorites, setFavorites] = useState<SearchResult[]>([]);
  const [expandedResultKeys, setExpandedResultKeys] = useState<string[]>([]);
  const [chatByResultKey, setChatByResultKey] = useState<Record<string, ChatMessage[]>>({});
  const [chatInputByResultKey, setChatInputByResultKey] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as SearchResult[];
      setFavorites(parsed);
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const favoriteKeys = useMemo(
    () => new Set(favorites.map((item) => getResultKey(item))),
    [favorites],
  );

  async function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter a search term first.");
      setResults([]);
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        q: trimmed,
        type: searchType,
      });
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Search failed. Please try again.");
      }

      const payload = (await response.json()) as { results: SearchResult[] };
      setResults(payload.results ?? []);
      setExpandedResultKeys([]);
      setChatByResultKey({});
      setChatInputByResultKey({});
    } catch {
      setError("Could not load live results right now.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleFavorite(result: SearchResult) {
    const key = getResultKey(result);
    setFavorites((current) => {
      const exists = current.some((item) => getResultKey(item) === key);
      if (exists) {
        return current.filter((item) => getResultKey(item) !== key);
      }
      return [result, ...current];
    });
  }

  function toggleExpanded(result: SearchResult) {
    const key = getResultKey(result);
    setExpandedResultKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function submitFollowUp(result: SearchResult, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = getResultKey(result);
    const rawQuestion = (chatInputByResultKey[key] ?? "").trim();

    if (!rawQuestion) {
      return;
    }

    const previousHistory = chatByResultKey[key] ?? [];
    const answer = buildFollowUpAnswer(result, rawQuestion, previousHistory);

    const nextHistory: ChatMessage[] = [
      ...previousHistory,
      { role: "user", text: rawQuestion },
      { role: "assistant", text: answer },
    ];

    setChatByResultKey((current) => ({
      ...current,
      [key]: nextHistory,
    }));

    setChatInputByResultKey((current) => ({
      ...current,
      [key]: "",
    }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">No Man&apos;s Sky Companion</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Live search mode: guidance is compiled in-app with no outbound links.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-200 p-4 shadow-sm dark:border-zinc-800">
          <form className="flex flex-col gap-3" onSubmit={onSearch}>
            <label htmlFor="query" className="text-sm font-medium">
              Search
            </label>
            <input
              id="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. radiant heart, nanites, salvaged data"
              className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchType("howto")}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  searchType === "howto"
                    ? "bg-foreground text-background"
                    : "border border-zinc-300 dark:border-zinc-700"
                }`}
              >
                How-to
              </button>
              <button
                type="button"
                onClick={() => setSearchType("where")}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  searchType === "where"
                    ? "bg-foreground text-background"
                    : "border border-zinc-300 dark:border-zinc-700"
                }`}
              >
                Where-to-find
              </button>

              <button
                type="submit"
                className="ml-auto rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Results</h2>
            {results.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                Search for something to see live compiled results.
              </p>
            ) : (
              <ul className="space-y-3">
                {results.map((result) => {
                  const resultKey = getResultKey(result);
                  const isFavorite = favoriteKeys.has(resultKey);
                  const isExpanded = expandedResultKeys.includes(resultKey);
                  const chatHistory = chatByResultKey[resultKey] ?? [];

                  return (
                    <li
                      key={resultKey}
                      className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold">{result.title}</h3>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(result)}
                          className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
                        >
                          {isFavorite ? "Saved" : "Save"}
                        </button>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">{result.summary}</p>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(result)}
                          className="text-xs underline underline-offset-2"
                        >
                          {isExpanded ? "Collapse details" : "Expand details"}
                        </button>

                        {isExpanded ? (
                          <div className="space-y-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/40">
                            <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-200">
                              {result.details}
                            </p>

                            {result.references.length > 0 ? (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                  References (in-app)
                                </p>
                                <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                                  {result.references.map((reference) => (
                                    <li key={`${resultKey}-${reference}`}>- {reference}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {result.redditNotes.length > 0 ? (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                  Reddit Notes (summarized)
                                </p>
                                <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                                  {result.redditNotes.map((note) => (
                                    <li key={`${resultKey}-${note}`}>- {note}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {result.video ? (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                  Video (in-app only)
                                </p>
                                <p className="text-sm text-zinc-700 dark:text-zinc-200">{result.video.title}</p>
                                <ol className="space-y-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                                  {result.video.segments.map((segment) => (
                                    <li key={`${resultKey}-${segment.label}`} className="space-y-1">
                                      <p className="font-medium text-zinc-800 dark:text-zinc-100">{segment.label}</p>
                                      <p className="text-zinc-700 dark:text-zinc-200">{segment.detail}</p>
                                    </li>
                                  ))}
                                </ol>
                                <p className="text-xs text-zinc-600 dark:text-zinc-300">{result.video.note}</p>
                              </div>
                            ) : null}

                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Ask Follow-up
                              </p>
                              <form
                                className="flex flex-col gap-2"
                                onSubmit={(event) => submitFollowUp(result, event)}
                              >
                                <input
                                  value={chatInputByResultKey[resultKey] ?? ""}
                                  onChange={(event) =>
                                    setChatInputByResultKey((current) => ({
                                      ...current,
                                      [resultKey]: event.target.value,
                                    }))
                                  }
                                  placeholder="Ask a follow-up question about this item"
                                  className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400"
                                />
                                <button
                                  type="submit"
                                  className="self-start rounded-full border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700"
                                >
                                  Ask
                                </button>
                              </form>

                              {chatHistory.length > 0 ? (
                                <ul className="space-y-2">
                                  {chatHistory.map((message, index) => (
                                    <li
                                      key={`${resultKey}-chat-${index}`}
                                      className={`rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                                        message.role === "user"
                                          ? "bg-zinc-200/60 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                                      }`}
                                    >
                                      <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                        {message.role === "user" ? "You" : "Companion"}
                                      </span>
                                      {message.text}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{result.source}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Favorites</h2>
            {favorites.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                No favorites yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {favorites.map((favorite) => (
                  <li
                    key={getResultKey(favorite)}
                    className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <h3 className="text-base font-semibold">{favorite.title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{favorite.summary}</p>
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{favorite.source}</span>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(favorite)}
                        className="rounded-full border border-zinc-300 px-2.5 py-1 dark:border-zinc-700"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
