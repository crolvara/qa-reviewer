import type { FindingSource, FindingType, Severity, Verdict } from "@/lib/types";

export const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-900 ring-red-300",
  major: "bg-amber-100 text-amber-900 ring-amber-300",
  minor: "bg-slate-100 text-slate-700 ring-slate-300",
};

export const HIGHLIGHT_STYLE: Record<Severity, string> = {
  critical: "bg-red-200/70 decoration-red-600",
  major: "bg-amber-200/70 decoration-amber-600",
  minor: "bg-slate-200 decoration-slate-500",
};

export const TYPE_LABEL: Record<FindingType, string> = {
  contradicted: "Contradicted",
  unsupported: "Unsupported",
  omission: "Omission",
  rule_breach: "Rule breach",
};

export const SOURCE_LABEL: Record<FindingSource, string> = {
  ai: "AI suggestion",
  rule: "Rule check",
  reviewer: "Reviewer",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  accurate: "Accurate",
  minor_issues: "Minor issues",
  needs_correction: "Needs correction",
};

export const VERDICT_STYLE: Record<Verdict, string> = {
  accurate: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  minor_issues: "bg-sky-100 text-sky-900 ring-sky-300",
  needs_correction: "bg-red-100 text-red-900 ring-red-300",
};

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}
