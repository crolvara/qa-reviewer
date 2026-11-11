"use client";

import { useCallback, useEffect, useState } from "react";
import type { Call, CallReview, Finding } from "./types";
import { EMPTY_REVIEW } from "./types";

const STORAGE_KEY = "qa-reviewer:v1";

type Reviews = Record<string, CallReview>;

function load(): Reviews {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Reviews) : {};
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
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
    } catch {
      // Storage full or blocked: the app keeps working in memory.
    }
  }, [reviews, loaded]);

  const update = useCallback((callId: string, patch: (r: CallReview) => CallReview) => {
    setReviews((prev) => ({
      ...prev,
      [callId]: { ...patch(getReview(prev, callId)), updatedAt: new Date().toISOString() },
    }));
  }, []);

  const reset = useCallback(() => setReviews({}), []);

  return { reviews, loaded, update, reset };
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
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
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
