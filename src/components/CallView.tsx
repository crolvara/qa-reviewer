"use client";

import { useEffect, useRef } from "react";
import type { Finding, Turn } from "@/lib/types";
import { HIGHLIGHT_STYLE } from "./ui";

interface Segment {
  text: string;
  finding: Finding | null;
}

/** Split the summary into plain and highlighted segments. Overlapping quotes keep the first match. */
function segmentSummary(summary: string, findings: Finding[]): Segment[] {
  const ranges = findings
    .filter((f) => f.summaryQuote)
    .map((f) => ({ start: summary.indexOf(f.summaryQuote as string), finding: f }))
    .filter((r) => r.start >= 0)
    .map((r) => ({ ...r, end: r.start + (r.finding.summaryQuote as string).length }))
    .sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    if (r.start > pos) out.push({ text: summary.slice(pos, r.start), finding: null });
    out.push({ text: summary.slice(r.start, r.end), finding: r.finding });
    pos = r.end;
  }
  if (pos < summary.length) out.push({ text: summary.slice(pos), finding: null });
  return out;
}

export function SummaryView({
  summary, findings, selectedId, onSelect,
}: {
  summary: string;
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const segments = segmentSummary(summary, findings);
  return (
    <p className="text-[15px] leading-7 text-slate-900">
      {segments.map((s, i) =>
        s.finding ? (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(s.finding!.id)}
            title={s.finding.title}
            className={`rounded-sm px-0.5 text-left underline decoration-2 underline-offset-4 ${HIGHLIGHT_STYLE[s.finding.severity]} ${
              selectedId === s.finding.id ? "outline-2 outline-offset-1 outline-indigo-600" : ""
            }`}
          >
            {s.text}
          </button>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}

const SPEAKER_STYLE: Record<Turn["kind"], string> = {
  agent: "text-indigo-800",
  customer: "text-emerald-800",
  third_party: "text-fuchsia-800",
  note: "text-slate-500",
  unclear: "text-slate-500",
};

export function TranscriptView({ turns, highlighted }: { turns: Turn[]; highlighted: string[] }) {
  const containerRef = useRef<HTMLOListElement>(null);
  const first = highlighted[0];

  useEffect(() => {
    if (!first || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-turn="${first}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [first, highlighted]);

  return (
    <ol ref={containerRef} className="space-y-1" aria-label="Transcript">
      {turns.map((t) => {
        const isHit = highlighted.includes(t.id);
        const isMeta = t.kind === "note" || t.kind === "unclear";
        return (
          <li
            key={t.id}
            data-turn={t.id}
            className={`grid grid-cols-[3.25rem_1fr] gap-2 rounded-md px-2 py-1.5 text-sm leading-6 ${
              isHit ? "bg-yellow-100 ring-2 ring-yellow-400" : ""
            } ${t.suspectHallucination ? "opacity-60" : ""}`}
          >
            <span className="pt-0.5 font-mono text-xs text-slate-500">
              {t.id}
              <br />
              {t.time}
            </span>
            <span className={isMeta ? "italic text-slate-600" : "text-slate-900"}>
              <span className={`mr-1 font-semibold not-italic ${SPEAKER_STYLE[t.kind]}`}>
                {t.kind === "third_party" ? `${t.speaker} (third party)` : t.speaker}:
              </span>
              {t.text}
              {t.suspectHallucination && (
                <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold not-italic text-slate-700">
                  Likely ASR hallucination (rule 8)
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
