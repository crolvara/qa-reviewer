import type { Finding, Turn } from "./types";

/**
 * Deterministic rule checks. Deliberately narrow: each one matches an exact
 * required phrase or a forbidden pattern from summary-rules.txt. Semantic
 * errors (wrong promise, invented facts) are left to the AI pre-review and the
 * reviewer. Loose keyword checks were tried and produced false positives.
 */

const US_SPELLINGS: Array<[RegExp, string]> = [
  [/\bauthorized\b/i, "authorised"],
  [/\bcenter\b/i, "centre"],
  [/\bprogram\b/i, "programme"],
  [/\borganization\b/i, "organisation"],
  [/\bbehavior\b/i, "behaviour"],
  [/\bcanceled\b/i, "cancelled"],
  [/\bcolor\b/i, "colour"],
];

// One entry per body; the pattern tolerates spacing variants ("MoneyHelper" / "Money Helper").
const ADVICE_BODIES: Array<[string, RegExp]> = [
  ["StepChange", /step\s*change/i],
  ["Citizens Advice", /citizens\s*advice/i],
  ["MoneyHelper", /money\s*helper/i],
  ["National Debtline", /national\s*debt\s*line/i],
];

export function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by a capital letter, so "5.30 pm" stays intact.
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((s) => s.trim().length > 0);
}

function agentTurns(turns: Turn[], re: RegExp): string[] {
  return turns.filter((t) => t.kind === "agent" && re.test(t.text)).map((t) => t.id);
}

export function runRuleChecks(callId: string, summary: string, turns: Turn[]): Finding[] {
  const out: Finding[] = [];
  let n = 0;
  const add = (f: Omit<Finding, "id" | "source">) => out.push({ ...f, id: `${callId}-rule-${++n}`, source: "rule" });

  // Arrears / balance amounts are forbidden.
  const arrears = summary.match(/(arrears|balance)[^.;]{0,25}£[\d,.]+|£[\d,.]+[^.;]{0,15}\b(arrears|balance)/i);
  if (arrears) {
    add({
      type: "rule_breach", severity: "major", certainty: "definite", summaryQuote: arrears[0], turns: [],
      title: "Arrears or balance amount stated",
      explanation: "The rules forbid specific values for arrears or total balance.",
      suggestedFix: "State only that arrears were discussed.",
    });
  }

  // Amount of a payment taken during the call is forbidden.
  const paid = summary.match(/payment of £[\d,.]+[^.;]{0,10}\b(made|taken)\b/i);
  if (paid) {
    add({
      type: "rule_breach", severity: "major", certainty: "definite", summaryQuote: paid[0], turns: [],
      title: "Amount of payment made stated",
      explanation: "The rules require the phrase \"Payment made.\" without the amount.",
      suggestedFix: "Payment made.",
    });
  }

  // Call direction, inferred from the opening turn.
  const first = turns[0];
  if (first && first.kind === "agent") {
    const outbound = /\b(speak to|speaking to|calling from)\b/i.test(first.text);
    const inbound = /how can i help/i.test(first.text);
    const saysInbound = summary.match(/The customer called the company/);
    const saysOutbound = summary.match(/The company called/);
    if (outbound && saysInbound) {
      add({
        type: "contradicted", severity: "critical", certainty: "definite", summaryQuote: saysInbound[0], turns: [first.id],
        title: "Call direction: outbound call recorded as inbound",
        explanation: "The agent opened by asking for a named person, so the company called the customer.",
        suggestedFix: "The company called and reached the customer.",
      });
    }
    if (inbound && saysOutbound) {
      add({
        type: "contradicted", severity: "critical", certainty: "definite", summaryQuote: saysOutbound[0], turns: [first.id],
        title: "Call direction: inbound call recorded as outbound",
        explanation: "The agent opened with a general service greeting, so the customer called the company.",
        suggestedFix: "The customer called the company.",
      });
    }
  }

  // Required phrases when the agent did the thing.
  const riskTurns = agentTurns(turns, /risk of further action/i);
  if (riskTurns.length && !/risk of further action/i.test(summary)) {
    add({
      type: "omission", severity: "major", certainty: "definite", summaryQuote: null, turns: riskTurns,
      title: "Missing \"risk of further action\"",
      explanation: "The agent explicitly warned of further action; the rules require this phrase.",
      suggestedFix: "Add: the customer was warned the account is at risk of further action.",
    });
  }

  const webTurns = agentTurns(turns, /website|signpost/i);
  if (webTurns.length && !/customer signposted/i.test(summary)) {
    add({
      type: "omission", severity: "major", certainty: "uncertain", summaryQuote: null, turns: webTurns,
      title: "Missing \"customer signposted\"",
      explanation: "The agent mentioned the website or signposting; the rules require \"customer signposted\". Check the turn is support-related.",
      suggestedFix: "Add: customer signposted.",
    });
  }

  for (const [body, re] of ADVICE_BODIES) {
    const bodyTurns = agentTurns(turns, re);
    if (bodyTurns.length && !re.test(summary)) {
      add({
        type: "omission", severity: "major", certainty: "uncertain", summaryQuote: null, turns: bodyTurns,
        title: `Referral to ${body} not mentioned`,
        explanation: "The agent referred the customer to an advice body; the rules require external advice referrals.",
        suggestedFix: `Add the ${body} referral.`,
      });
    }
  }

  // Terminology: "further action" only allowed as "risk of further action".
  const further = summary.match(/[^.;]*\bfurther action\b[^.;]*/i);
  if (further && !/risk of further action/i.test(further[0])) {
    add({
      type: "rule_breach", severity: "minor", certainty: "definite", summaryQuote: further[0].trim(), turns: [],
      title: "\"further action\" used for next steps",
      explanation: "The rules reserve \"further action\" for the risk warning.",
      suggestedFix: "Use \"next steps\".",
    });
  }

  // Format.
  // Gatekeeper outputs ("Incomplete call.", voicemail) are valid one-liners.
  const isGatekeeper = /^(Incomplete call\.|Voicemail (left|reached))/i.test(summary.trim());
  const count = splitSentences(summary).length;
  if (!isGatekeeper && (count < 2 || count > 5)) {
    add({
      type: "rule_breach", severity: "minor", certainty: "definite", summaryQuote: null, turns: [],
      title: `Summary has ${count} sentence${count === 1 ? "" : "s"} (rule: 2 to 5)`,
      explanation: "The rules require a concise summary of 2 to 5 complete sentences.",
      suggestedFix: null,
    });
  }

  for (const [re, uk] of US_SPELLINGS) {
    const m = summary.match(re);
    if (m) {
      add({
        type: "rule_breach", severity: "minor", certainty: "definite", summaryQuote: m[0], turns: [],
        title: `American spelling "${m[0]}"`,
        explanation: "The summary must use British English.",
        suggestedFix: uk,
      });
    }
  }

  for (const f of out) {
    f.matchKey = matchKeyFor(f.title);
    // Stable ID from the rule title (unique per call), not from check order.
    f.id = `${callId}-rule-${f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  }
  return out;
}

/** What an AI finding must talk about to be treated as the same issue as a rule finding. */
function matchKeyFor(title: string): RegExp {
  const referral = title.match(/^Referral to (.+) not mentioned$/);
  if (referral?.[1]) return ADVICE_BODIES.find(([name]) => name === referral[1])?.[1] ?? /(?!)/;
  if (/^Arrears/.test(title)) return /arrears|balance/i;
  if (/^Amount of payment/.test(title)) return /payment/i;
  if (/^Call direction/.test(title)) return /direction|inbound|outbound|called/i;
  if (/risk of further action|"further action"/.test(title)) return /further action/i;
  if (/signposted/.test(title)) return /signpost/i;
  if (/sentence/.test(title)) return /sentence/i;
  if (/^American spelling/.test(title)) return /spelling|british|american/i;
  return /(?!)/; // never matches
}
