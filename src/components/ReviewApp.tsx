"use client";

import { useEffect, useMemo, useState } from "react";
import { CALLS, formatCallDate } from "@/lib/data";
import { allFindings, download, getReview, isOpen, toCsv, useReviews } from "@/lib/review-store";
import type { Call, CallReview, Severity, Verdict } from "@/lib/types";
import { SummaryView, TranscriptView } from "./CallView";
import { useConfirm } from "./ConfirmDialog";
import { FindingsPanel } from "./FindingsPanel";
import { Badge, SEVERITY_STYLE, VERDICT_LABEL, VERDICT_STYLE } from "./ui";

type Filter = "all" | "todo" | "needs_correction";
const VERDICTS: Verdict[] = ["accurate", "minor_issues", "needs_correction"];

function severityCounts(call: Call, review: CallReview): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, major: 0, minor: 0 };
  for (const f of allFindings(call, review)) if (isOpen(f, review)) c[f.severity]++;
  return c;
}

export default function ReviewApp() {
  const { reviews, loaded, update, reset, saveFailed } = useReviews();
  const [currentId, setCurrentId] = useState<string>(CALLS[0]?.id ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  // Single-key shortcuts can be switched off (WCAG 2.1.4). Remembered per browser.
  const [shortcutsOn, setShortcutsOn] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read preference after mount
      if (window.localStorage.getItem("qa-reviewer:shortcuts") === "off") setShortcutsOn(false);
    } catch {}
  }, []);
  const toggleShortcuts = (on: boolean) => {
    setShortcutsOn(on);
    try {
      window.localStorage.setItem("qa-reviewer:shortcuts", on ? "on" : "off");
    } catch {}
  };

  const call = CALLS.find((c) => c.id === currentId) ?? CALLS[0];
  const review = call ? getReview(reviews, call.id) : null;
  const reviewedCount = CALLS.filter((c) => getReview(reviews, c.id).verdict).length;

  const visible = useMemo(
    () =>
      CALLS.filter((c) => {
        const r = getReview(reviews, c.id);
        if (filter === "todo") return !r.verdict;
        if (filter === "needs_correction") return r.verdict === "needs_correction";
        return true;
      }),
    [reviews, filter],
  );

  const goTo = (id: string) => {
    setCurrentId(id);
    setSelectedFinding(null);
  };

  // Keyboard: J/K next/previous call, 1/2/3 verdict. Ignored while typing.
  useEffect(() => {
    if (!shortcutsOn) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      // A modal is open: shortcuts must not change data behind it.
      if (target?.closest?.("dialog[open]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Holding a key must not race through calls or re-set verdicts.
      if (e.repeat) return;
      if (e.key === "Escape") {
        setSelectedFinding(null);
        return;
      }
      // Case-insensitive so Caps Lock or Shift does not silently break shortcuts.
      const key = e.key.toLowerCase();
      // Navigate within the filtered queue, relative to the current call's position in
      // the full list, so it still works after the current call leaves the filter.
      const list = visible.length > 0 ? visible : CALLS;
      const pos = CALLS.findIndex((c) => c.id === currentId);
      const order = (id: string) => CALLS.findIndex((c) => c.id === id);
      if (key === "j") {
        const next = list.find((c) => order(c.id) > pos);
        if (next) goTo(next.id);
      }
      if (key === "k") {
        const prev = [...list].reverse().find((c) => order(c.id) < pos);
        if (prev) goTo(prev.id);
      }
      const v = VERDICTS[Number(e.key) - 1];
      if (v && ["1", "2", "3"].includes(e.key)) update(currentId, (r) => ({ ...r, verdict: v }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentId, update, visible, shortcutsOn]);

  if (!call || !review) return <p className="p-6">No calls found.</p>;

  const findings = allFindings(call, review);
  const highlightedTurns = findings.find((f) => f.id === selectedFinding)?.turns ?? [];
  const counts = severityCounts(call, review);
  const hasOpenCritical = counts.critical > 0;

  const exportCsv = () => download(`qa-review-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(CALLS, reviews), "text/csv;charset=utf-8");
  const exportJson = () => download(`qa-review-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(reviews, null, 2), "application/json");

  return (
    // w-full + min-w-0: the root is a flex item of <body>; without these it grows to its widest child and the page scrolls sideways on phones.
    <div className="flex min-h-screen w-full min-w-0 flex-col bg-slate-50 text-slate-900 lg:h-screen">
      {saveFailed && (
        <p role="alert" className="bg-red-700 px-4 py-1.5 text-sm font-medium text-white">
          Decisions are not being saved in this browser. Export before closing the page.
        </p>
      )}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <h1 className="text-base font-bold tracking-tight">QA Reviewer</h1>
        <span className="text-sm text-slate-600">Call summary accuracy</span>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full sm:ml-auto">
          <div className="flex items-center gap-2 max-sm:w-full">
            <span className="whitespace-nowrap text-sm text-slate-700" aria-live="polite">
              <strong>{loaded ? reviewedCount : "-"}</strong> / {CALLS.length} reviewed
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 max-sm:flex-1" aria-hidden>
              <div className="h-full bg-indigo-600" style={{ width: `${(reviewedCount / CALLS.length) * 100}%` }} />
            </div>
          </div>
          <button type="button" onClick={exportCsv} className="whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50">Export CSV</button>
          <button type="button" onClick={exportJson} className="whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50">Export JSON</button>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "Reset all reviews?",
                message: "This clears every verdict, decision and correction saved in this browser. Export first if you need them.",
                confirmLabel: "Reset",
                destructive: true,
              });
              if (ok) reset();
            }}
            className="whitespace-nowrap rounded-md px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)_24rem]">
        {/* Queue */}
        <nav aria-label="Calls" className="flex min-h-0 flex-col border-r border-slate-200 bg-white max-lg:max-h-64">
          <div className="flex gap-1 border-b border-slate-200 p-2" role="tablist">
            {([["all", "All"], ["todo", "To review"], ["needs_correction", "Needs fix"]] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${filter === k ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 && <li className="p-3 text-sm text-slate-600">No calls in this view.</li>}
            {visible.map((c) => {
              const r = getReview(reviews, c.id);
              const sc = severityCounts(c, r);
              const active = c.id === call.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => goTo(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={`w-full border-b border-slate-100 px-3 py-2 text-left ${active ? "bg-indigo-50 shadow-[inset_3px_0_0] shadow-indigo-600" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold">{c.id}</span>
                      {r.verdict ? (
                        <Badge className={VERDICT_STYLE[r.verdict]}>{VERDICT_LABEL[r.verdict]}</Badge>
                      ) : (
                        <span className="text-[11px] text-slate-600">Not reviewed</span>
                      )}
                    </div>
                    <div className="mt-1 flex gap-1 text-[11px]">
                      {(["critical", "major", "minor"] as const).map((s) =>
                        sc[s] > 0 ? (
                          <span key={s} className={`rounded px-1 ring-1 ring-inset ${SEVERITY_STYLE[s]}`}>
                            {sc[s]} {s}
                          </span>
                        ) : null,
                      )}
                      {sc.critical + sc.major + sc.minor === 0 && <span className="text-slate-600">No open flags</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-slate-200 p-2 text-[11px] text-slate-600">
            <label className="flex items-center gap-1.5 font-medium text-slate-700">
              <input type="checkbox" checked={shortcutsOn} onChange={(e) => toggleShortcuts(e.target.checked)} />
              Keyboard shortcuts
            </label>
            {shortcutsOn && <p className="mt-0.5">J/K next/previous · 1/2/3 verdict · Esc clear selection</p>}
          </div>
        </nav>

        {/* Summary + transcript */}
        <main className="min-h-0 overflow-y-auto p-4 lg:p-6">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-mono text-lg font-bold">{call.id}</h2>
            <span className="text-sm text-slate-600">{formatCallDate(call.callDate)} · {call.duration}</span>
          </div>

          <section aria-labelledby="summary-h" className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 id="summary-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Summary under review</h3>
            <SummaryView
              summary={call.summary}
              findings={findings.filter((f) => isOpen(f, review))}
              selectedId={selectedFinding}
              onSelect={setSelectedFinding}
            />
            {(() => {
              const omissions = findings.filter((f) => !f.summaryQuote && f.type === "omission" && isOpen(f, review));
              return omissions.length > 0 ? (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Possibly missing</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {omissions.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedFinding(f.id)}
                          className={`rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SEVERITY_STYLE[f.severity]} ${selectedFinding === f.id ? "outline-2 outline-indigo-600" : ""}`}
                        >
                          {f.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}
          </section>

          <section aria-labelledby="transcript-h" className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <h3 id="transcript-h" className="px-2 pb-1 pt-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
              Transcript <span className="font-normal normal-case text-slate-600">(the reference)</span>
            </h3>
            <TranscriptView turns={call.turns} highlighted={highlightedTurns} />
          </section>
        </main>

        {/* Findings + decision */}
        <aside className="min-h-0 space-y-5 overflow-y-auto border-l border-slate-200 bg-slate-100/60 p-4">
          <section aria-labelledby="verdict-h" className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 id="verdict-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">Verdict</h2>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Verdict">
              {VERDICTS.map((v, i) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={review.verdict === v}
                  onClick={() => update(call.id, (r) => ({ ...r, verdict: v }))}
                  className={`rounded-md px-2 py-2 text-xs font-semibold ring-1 ring-inset ${
                    review.verdict === v ? VERDICT_STYLE[v] + " ring-2" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="mr-1 text-slate-600">{i + 1}</span>
                  {VERDICT_LABEL[v]}
                </button>
              ))}
            </div>
            {(() => {
              // Tie the verdict to the findings: surface contradictions instead of silently accepting them.
              const pre = findings.filter((f) => f.source !== "reviewer");
              const confirmed = findings.filter((f) => f.source === "reviewer" || review.decisions[f.id] === "accepted").length;
              const rejected = pre.filter((f) => review.decisions[f.id] === "rejected").length;
              const pending = pre.length - pre.filter((f) => review.decisions[f.id]).length;
              const warnings: string[] = [];
              if (review.verdict === "accurate" && confirmed > 0) warnings.push(`${confirmed} confirmed finding(s) contradict "Accurate".`);
              if (review.verdict === "accurate" && hasOpenCritical && pending > 0) warnings.push("Critical findings are still pending.");
              if (review.verdict && review.verdict !== "accurate" && confirmed === 0) warnings.push("No confirmed finding supports this verdict.");
              if (review.verdict === "needs_correction" && !review.correctedSummary.trim()) warnings.push("Add a corrected summary.");
              return (
                <>
                  <p className="mt-2 text-xs text-slate-700">
                    <strong>{confirmed}</strong> confirmed · <strong>{rejected}</strong> rejected · <strong>{pending}</strong> pending
                  </p>
                  {warnings.length > 0 && (
                    <ul role="status" className="mt-2 list-disc space-y-0.5 rounded bg-amber-50 py-2 pl-6 pr-2 text-xs text-amber-900">
                      {warnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  )}
                  {review.verdict && (
                    <button
                      type="button"
                      onClick={() => update(call.id, (r) => ({ ...r, verdict: null }))}
                      className="mt-2 text-xs text-slate-600 underline hover:text-slate-900"
                    >
                      Clear verdict
                    </button>
                  )}
                </>
              );
            })()}
            {/* Collapsed by default so the reviewer forms their own view first (anchoring bias). Keyed per call so it re-collapses. */}
            <details key={call.id} className="mt-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">Show AI pre-review verdict</summary>
              <p className="mt-1">
                {VERDICT_LABEL[call.aiOverall]}. {call.aiRationale}
              </p>
            </details>
          </section>

          <FindingsPanel
            key={call.id}
            callId={call.id}
            findings={findings}
            review={review}
            selectedId={selectedFinding}
            onSelect={setSelectedFinding}
            onDecide={(id, d) =>
              update(call.id, (r) => {
                const decisions = { ...r.decisions };
                if (d) decisions[id] = d;
                else delete decisions[id];
                return { ...r, decisions };
              })
            }
            onAdd={(f) => {
              // Keep only turn IDs that exist in this transcript.
              const valid = new Set(call.turns.map((t) => t.id));
              const clean = { ...f, turns: [...new Set(f.turns)].filter((t) => valid.has(t)) };
              update(call.id, (r) => ({ ...r, reviewerFindings: [...r.reviewerFindings, clean] }));
            }}
            onRemove={(id) => update(call.id, (r) => ({ ...r, reviewerFindings: r.reviewerFindings.filter((f) => f.id !== id) }))}
          />

          <section aria-labelledby="fix-h" className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 id="fix-h" className="text-sm font-semibold uppercase tracking-wide text-slate-600">Correction</h2>
            <label className="block text-xs font-medium text-slate-700">
              Corrected summary
              <textarea
                rows={6}
                value={review.correctedSummary}
                onChange={(e) => update(call.id, (r) => ({ ...r, correctedSummary: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm leading-6 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>
            {call.aiCorrectedSummary && (
              <button
                type="button"
                onClick={async () => {
                  const current = review.correctedSummary.trim();
                  if (current && current !== call.aiCorrectedSummary) {
                    const ok = await confirm({
                      title: "Replace your corrected summary?",
                      message: "Your edits will be overwritten with the AI suggestion.",
                      confirmLabel: "Replace",
                      destructive: true,
                    });
                    if (!ok) return;
                  }
                  update(call.id, (r) => ({ ...r, correctedSummary: call.aiCorrectedSummary ?? "" }));
                }}
                className="text-xs font-medium text-indigo-700 underline hover:text-indigo-900"
              >
                Start from AI suggested correction
              </button>
            )}
            <label className="block text-xs font-medium text-slate-700">
              Reviewer note
              <textarea
                rows={2}
                value={review.note}
                onChange={(e) => update(call.id, (r) => ({ ...r, note: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>
          </section>
        </aside>
      </div>
      {confirmDialog}
    </div>
  );
}
