"use client";

import { useCallback, useEffect, useState } from "react";
import type { Call, CallReview, Finding } from "./types";
import { EMPTY_REVIEW } from "./types";

const STORAGE_KEY = "qa-reviewer:v1";
const RESET_KEY = "qa-reviewer:reset-at";

type Reviews = Record<string, CallReview>;

const VERDICT_VALUES = new Set(["accurate", "minor_issues", "needs_correction"]);
const str = (v: unknown, max = 5000): string => (typeof v === "string" ? v.slice(0, max) : "");
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Validate one stored review field by field; anything malformed falls back to a safe default. */
function sanitizeReview(v: unknown): CallReview {
  if (!isRecord(v)) return EMPTY_REVIEW;
  const decisions: CallReview["decisions"] = {};
  if (isRecord(v.decisions)) {
    for (const [k, d] of Object.entries(v.decisions)) if (d === "accepted" || d === "rejected") decisions[k] = d;
  }
  const reviewerFindings = (Array.isArray(v.reviewerFindings) ? v.reviewerFindings : [])
    .filter(isRecord)
    .filter((f) => typeof f.id === "string" && typeof f.title === "string")
    .map((f): Finding => ({
      id: f.id as string,
      source: "reviewer",
      type: (["contradicted", "unsupported", "omission", "rule_breach"].includes(f.type as string) ? f.type : "contradicted") as Finding["type"],
      severity: (["critical", "major", "minor"].includes(f.severity as string) ? f.severity : "major") as Finding["severity"],
      certainty: "definite",
      summaryQuote: null,
      turns: Array.isArray(f.turns) ? f.turns.filter((t): t is string => typeof t === "string") : [],
      title: str(f.title, 200),
      explanation: str(f.explanation),
      suggestedFix: null,
    }));
  return {
    verdict: VERDICT_VALUES.has(v.verdict as string) ? (v.verdict as CallReview["verdict"]) : null,
    decisions,
    reviewerFindings,
    note: str(v.note),
    correctedSummary: str(v.correctedSummary),
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null,
  };
}

function load(): Reviews {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const out: Reviews = {};
    for (const [id, r] of Object.entries(parsed)) if (/^CALL-\d+$/.test(id)) out[id] = sanitizeReview(r);
    return out;
  } catch {
    return {};
  }
}

/**
 * Review decisions persisted in localStorage. Loaded after mount to avoid a
 * hydration mismatch (storage does not exist during pre-render).
 */
export function useReviews() {
  const [reviews, setReviews] = useState<Reviews>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off sync from external storage after mount
    setReviews(load());
    setLoaded(true);
    // Another tab saved: adopt its state instead of overwriting it on our next write.
    const onStorage = (e: StorageEvent) => {
      // A reset in another tab must clear this tab too, not be merged back.
      if (e.key === RESET_KEY) {
        setReviews({});
        return;
      }
      if (e.key !== STORAGE_KEY) return;
      // Merge per call, newest updatedAt wins, so edits to different calls in two tabs both survive.
      const incoming = load();
      setReviews((prev) => {
        const merged: Reviews = { ...prev };
        for (const [id, r] of Object.entries(incoming)) {
          const mine = prev[id];
          if (!mine || (r.updatedAt ?? "") > (mine.updatedAt ?? "")) merged[id] = r;
        }
        return merged;
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    try {
      const next = JSON.stringify(reviews);
      // Skip identical writes (e.g. right after syncing from another tab).
      if (window.localStorage.getItem(STORAGE_KEY) !== next) window.localStorage.setItem(STORAGE_KEY, next);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects the external storage result
      setSaveFailed(false);
    } catch {
      // Storage full or blocked: keep working in memory, but tell the reviewer.
      setSaveFailed(true);
    }
  }, [reviews, loaded]);

  const update = useCallback((callId: string, patch: (r: CallReview) => CallReview) => {
    setReviews((prev) => ({
      ...prev,
      [callId]: { ...patch(getReview(prev, callId)), updatedAt: new Date().toISOString() },
    }));
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.setItem(RESET_KEY, new Date().toISOString());
    } catch {}
    setReviews({});
  }, []);

  return { reviews, loaded, update, reset, saveFailed };
}

export function getReview(reviews: Reviews, callId: string): CallReview {
  const stored = reviews[callId];
  if (!stored) return EMPTY_REVIEW;
  // Defend against stale or hand-edited storage missing fields.
  return {
    ...EMPTY_REVIEW,
    ...stored,
    decisions: stored.decisions ?? {},
    reviewerFindings: Array.isArray(stored.reviewerFindings) ? stored.reviewerFindings : [],
  };
}

/** All findings for a call: pre-generated plus the reviewer's own. */
export function allFindings(call: Call, review: CallReview): Finding[] {
  return [...call.findings, ...review.reviewerFindings];
}

/** A finding counts unless the reviewer rejected it. Reviewer findings always count. */
export function isOpen(f: Finding, review: CallReview): boolean {
  return review.decisions[f.id] !== "rejected";
}

// ---------- Export ----------

function csvCell(value: string): string {
  // Neutralise spreadsheet formula injection, then quote.
  // Checks after leading whitespace too, and full-width variants some spreadsheets accept.
  const safe = /^[=+\-@\t\r\n＝＋－＠]/.test(value.trimStart()) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(calls: Call[], reviews: Reviews): string {
  const header = [
    "call_id", "verdict", "confirmed_findings", "rejected_findings", "pending_findings",
    "findings_detail", "reviewer_note", "corrected_summary", "updated_at",
  ];
  const rows = calls.map((call) => {
    const r = getReview(reviews, call.id);
    const all = allFindings(call, r);
    const confirmed = all.filter((f) => f.source === "reviewer" || r.decisions[f.id] === "accepted");
    const rejected = all.filter((f) => r.decisions[f.id] === "rejected");
    const pending = all.length - confirmed.length - rejected.length;
    const detail = confirmed
      .map((f) => `[${f.severity}/${f.type}] ${f.title} (${f.turns.join(" ") || "summary"})`)
      .join(" | ");
    return [
      call.id, r.verdict ?? "not_reviewed", String(confirmed.length), String(rejected.length), String(pending),
      detail, r.note, r.correctedSummary, r.updatedAt ?? "",
    ].map(csvCell).join(",");
  });
  // BOM so Excel reads UTF-8 (£ and curly apostrophes) correctly.
  return "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n");
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
