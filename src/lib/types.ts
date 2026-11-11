export type FindingType = "contradicted" | "unsupported" | "omission" | "rule_breach";
export type Severity = "critical" | "major" | "minor";
export type Certainty = "definite" | "uncertain";
export type Verdict = "accurate" | "minor_issues" | "needs_correction";
export type FindingSource = "ai" | "rule" | "reviewer";
export type Decision = "accepted" | "rejected";
export type TurnKind = "agent" | "customer" | "third_party" | "note" | "unclear";

export interface Finding {
  id: string;
  source: FindingSource;
  type: FindingType;
  severity: Severity;
  certainty: Certainty;
  /** Exact substring of the summary, or null (omissions). */
  summaryQuote: string | null;
  turns: string[];
  title: string;
  explanation: string;
  suggestedFix: string | null;
  /** AI finding independently matched by a deterministic rule check. */
  ruleConfirmed?: boolean;
  /** Rule findings only: words an AI finding must mention to count as the same issue. */
  matchKey?: RegExp;
}

export interface Turn {
  id: string;
  time: string;
  speaker: string;
  kind: TurnKind;
  text: string;
  suspectHallucination: boolean;
}

export interface Call {
  id: string;
  callDate: string;
  duration: string;
  summary: string;
  turns: Turn[];
  aiOverall: Verdict;
  aiRationale: string;
  aiCorrectedSummary: string | null;
  /** AI + deterministic rule findings, generated before review. */
  findings: Finding[];
}

export interface CallReview {
  verdict: Verdict | null;
  decisions: Record<string, Decision>;
  reviewerFindings: Finding[];
  note: string;
  correctedSummary: string;
  updatedAt: string | null;
}

export const EMPTY_REVIEW: CallReview = {
  verdict: null,
  decisions: {},
  reviewerFindings: [],
  note: "",
  correctedSummary: "",
  updatedAt: null,
};
