import rawCalls from "@/data/calls.json";
import rawAi from "@/data/ai-findings.json";
import { runRuleChecks } from "./checks";
import type { Call, Finding, Turn, TurnKind, Verdict } from "./types";

interface RawCall {
  id: string;
  call_date: string;
  estimated_duration: string;
  transcript: string;
  summary: string;
}

interface RawAiReview {
  callId: string;
  overall: Verdict;
  rationale: string;
  findings: Array<Omit<Finding, "id" | "source">>;
  correctedSummary: string | null;
}

const TURN_RE = /^(T\d+) \[(\d{2}:\d{2})\] ([^:]+): (.*)$/;
// ASR hallucinations during hold or silence (rule 8).
const HALLUCINATION_RE = /thank you for watching|subscribe for more|like and subscribe/i;

function kindOf(speaker: string): TurnKind {
  const s = speaker.trim().toLowerCase();
  if (s === "agent") return "agent";
  if (s === "customer") return "customer";
  if (s === "transcript note") return "note";
  if (s.startsWith("unclear")) return "unclear";
  return "third_party";
}

export function parseTranscript(text: string): Turn[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, i): Turn => {
      const m = line.match(TURN_RE);
      if (!m) {
        // Keep unparseable lines visible rather than dropping evidence.
        return { id: `L${i + 1}`, time: "", speaker: "Unparsed", kind: "unclear", text: line, suspectHallucination: false };
      }
      const [, id = "", time = "", speaker = "", body = ""] = m;
      const kind = kindOf(speaker);
      return {
        id,
        time,
        speaker,
        kind,
        text: body,
        // Only generic out-of-context phrases are flagged; a genuinely unclear speaker is not.
        suspectHallucination: HALLUCINATION_RE.test(body),
      };
    });
}

/**
 * A rule finding duplicates an AI finding only when both are the same type, the AI
 * finding is about the same rule (matchKey), and they overlap on quote or turns.
 * Turn overlap alone is not enough: one turn can carry two obligations.
 */
function sameIssue(ai: Finding, rule: Finding): boolean {
  if (ai.type !== rule.type) return false;
  // Title only: explanations often mention neighbouring obligations (e.g. a referral next to signposting).
  if (!rule.matchKey?.test(ai.title)) return false;
  const q1 = ai.summaryQuote;
  const q2 = rule.summaryQuote;
  if (q1 && q2 && (q1.includes(q2) || q2.includes(q1))) return true;
  return rule.turns.some((t) => ai.turns.includes(t));
}

/** Stable short hash (FNV-1a) of what makes a finding unique. */
export function contentId(f: Pick<Finding, "type" | "summaryQuote" | "turns" | "title">): string {
  const s = [f.type, f.summaryQuote ?? "", [...f.turns].sort().join(","), f.title].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const aiById = new Map((rawAi as unknown as RawAiReview[]).map((r) => [r.callId, r]));

export const CALLS: Call[] = (rawCalls as unknown as RawCall[])
  .map((c): Call => {
    const turns = parseTranscript(c.transcript);
    const ai = aiById.get(c.id);
    // Content-based IDs: saved decisions stay attached to the same finding if the AI file is reordered or regenerated.
    const aiFindings: Finding[] = (ai?.findings ?? []).map((f) => ({ ...f, id: `${c.id}-ai-${contentId(f)}`, source: "ai" }));
    return {
      id: c.id,
      callDate: c.call_date,
      duration: c.estimated_duration,
      summary: c.summary,
      turns,
      aiOverall: ai?.overall ?? "accurate",
      aiRationale: ai?.rationale ?? "No AI pre-review available.",
      aiCorrectedSummary: ai?.correctedSummary ?? null,
      findings: (() => {
        const rules = runRuleChecks(c.id, c.summary, turns);
        const ai = aiFindings.map((a) => ({ ...a, ruleConfirmed: rules.some((r) => sameIssue(a, r)) }));
        return [...ai, ...rules.filter((r) => !aiFindings.some((a) => sameIssue(a, r)))];
      })(),
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

/** "2026-10-20" -> "Tue 20 Oct 2026". Parsed as UTC to avoid timezone shifts. */
export function formatCallDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
