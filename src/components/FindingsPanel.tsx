"use client";

import { useState } from "react";
import type { CallReview, Finding, FindingType, Severity } from "@/lib/types";
import { Badge, SEVERITY_STYLE, SOURCE_LABEL, TYPE_LABEL } from "./ui";

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };

export function FindingsPanel({
  callId, findings, review, selectedId, onSelect, onDecide, onAdd, onRemove,
}: {
  callId: string;
  findings: Finding[];
  review: CallReview;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDecide: (id: string, decision: "accepted" | "rejected" | null) => void;
  onAdd: (f: Finding) => void;
  onRemove: (id: string) => void;
}) {
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const pending = findings.filter((f) => f.source !== "reviewer" && !review.decisions[f.id]).length;

  return (
    <section aria-labelledby="findings-h">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="findings-h" className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Findings ({findings.length})
        </h2>
        <span className="text-xs text-slate-600">{pending} awaiting decision</span>
      </div>

      {sorted.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-600">
          No issues flagged. Read the transcript before marking accurate.
        </p>
      )}

      <ul className="space-y-2">
        {sorted.map((f) => {
          const decision = review.decisions[f.id];
          const selected = selectedId === f.id;
          return (
            <li
              key={f.id}
              // Rejected = dashed, tinted card + struck title. No opacity: fading text fails WCAG contrast.
              className={`rounded-lg border p-3 shadow-sm transition ${
                selected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
              } ${decision === "rejected" ? "border-dashed bg-slate-50 shadow-none" : "bg-white"}`}
            >
              <button type="button" className="w-full text-left" onClick={() => onSelect(selected ? null : f.id)}>
                <div className="mb-1 flex flex-wrap items-center gap-1">
                  <Badge className={SEVERITY_STYLE[f.severity]}>{f.severity}</Badge>
                  <Badge className="bg-white text-slate-700 ring-slate-300">{TYPE_LABEL[f.type]}</Badge>
                  {f.certainty === "uncertain" && <Badge className="bg-violet-50 text-violet-800 ring-violet-300">Uncertain</Badge>}
                  {f.ruleConfirmed && <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-300">Rule-confirmed</Badge>}
                  <span className="ml-auto text-[11px] text-slate-600">{SOURCE_LABEL[f.source]}</span>
                </div>
                <p className={`text-sm font-semibold text-slate-900 ${decision === "rejected" ? "line-through" : ""}`}>{f.title}</p>
                {f.turns.length > 0 && <p className="mt-0.5 font-mono text-xs text-slate-600">Evidence: {callId} {f.turns.join(", ")}</p>}
              </button>

              {selected && (f.explanation || f.suggestedFix) && (
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-sm text-slate-700">
                  {f.explanation && <p>{f.explanation}</p>}
                  {f.suggestedFix && (
                    <p>
                      <span className="font-semibold text-slate-900">Suggested fix: </span>
                      {f.suggestedFix}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                {f.source === "reviewer" ? (
                  <button type="button" onClick={() => onRemove(f.id)} className="text-xs font-medium text-slate-600 underline hover:text-red-700">
                    Remove
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-pressed={decision === "accepted"}
                      onClick={() => onDecide(f.id, decision === "accepted" ? null : "accepted")}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                        decision === "accepted" ? "bg-emerald-700 text-white ring-emerald-700" : "bg-white text-emerald-800 ring-emerald-300 hover:bg-emerald-50"
                      }`}
                    >
                      {decision === "accepted" ? "✓ Confirmed" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      aria-pressed={decision === "rejected"}
                      onClick={() => onDecide(f.id, decision === "rejected" ? null : "rejected")}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                        decision === "rejected" ? "bg-slate-700 text-white ring-slate-700" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {decision === "rejected" ? "✕ Rejected" : "Reject"}
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <AddFindingForm callId={callId} onAdd={onAdd} />
    </section>
  );
}

function AddFindingForm({ callId, onAdd }: { callId: string; onAdd: (f: Finding) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FindingType>("contradicted");
  const [severity, setSeverity] = useState<Severity>("major");
  const [turns, setTurns] = useState("");
  const [title, setTitle] = useState("");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 w-full rounded-md border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        + Add your own finding
      </button>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const turnIds = turns
      .toUpperCase()
      .split(/[\s,]+/)
      .filter((t) => /^T\d+$/.test(t));
    onAdd({
      id: `${callId}-rev-${Date.now()}`,
      source: "reviewer",
      type,
      severity,
      certainty: "definite",
      summaryQuote: null,
      turns: turnIds,
      title: cleanTitle.slice(0, 200),
      explanation: "",
      suggestedFix: null,
    });
    setTitle("");
    setTurns("");
    setOpen(false);
  };

  const field = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-700">
          Type
          <select className={field} value={type} onChange={(e) => setType(e.target.value as FindingType)}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Severity
          <select className={field} value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-700">
        What is wrong
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="e.g. Promise amount differs from T15" />
      </label>
      <label className="block text-xs font-medium text-slate-700">
        Evidence turns
        <input className={field} value={turns} onChange={(e) => setTurns(e.target.value)} placeholder="T14, T15" />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800">Add finding</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
      </div>
    </form>
  );
}
