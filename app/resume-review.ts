// Résumé reviewer.
//
// Critiques the candidate's actual text — quoting the lines it objects to and
// showing a concrete rewrite — rather than listing generic résumé tips. Runs
// entirely in the browser, same as the rest of the app.

export type ReviewCheck = {
  label: string;
  status: "pass" | "warn" | "fail";
  /** What was found, in the candidate's own words where possible. */
  detail: string;
  /** The specific next action. Empty when the check passed. */
  fix: string;
};

export type BulletNote = {
  original: string;
  issues: string[];
  rewrite: string;
};

export type ResumeReview = {
  score: number;
  wordCount: number;
  checks: ReviewCheck[];
  bullets: BulletNote[];
  missingKeywords: string[];
};

// Openers that bury what the candidate actually did.
const WEAK_OPENERS: Array<{ pattern: RegExp; verb: string }> = [
  { pattern: /^(?:i\s+was\s+|was\s+)?responsible\s+for\s+/i, verb: "Owned" },
  { pattern: /^(?:i\s+)?(?:helped|assisted)\s+(?:with|in|to)?\s*/i, verb: "Supported" },
  { pattern: /^(?:i\s+)?worked\s+(?:on|with|at)\s+/i, verb: "Built" },
  { pattern: /^(?:my\s+)?duties\s+included\s+/i, verb: "Ran" },
  { pattern: /^(?:i\s+was\s+)?tasked\s+with\s+/i, verb: "Delivered" },
  { pattern: /^(?:i\s+was\s+)?involved\s+in\s+/i, verb: "Contributed to" },
  { pattern: /^(?:i\s+)?participated\s+in\s+/i, verb: "Contributed to" },
  { pattern: /^(?:i\s+)?took\s+part\s+in\s+/i, verb: "Contributed to" },
];

const FILLER = ["various", "several", "many", "a lot of", "lots of", "stuff", "things", "etc", "and so on", "some"];

const CLICHES = [
  "team player",
  "hard worker",
  "hard working",
  "hardworking",
  "go-getter",
  "think outside the box",
  "self-motivated",
  "self motivated",
  "detail oriented",
  "detail-oriented",
  "results driven",
  "results-driven",
  "passionate about",
  "dynamic individual",
  "excellent communication skills",
  "good communication skills",
];

// Details that invite bias and are not job-relevant. Flagging these is the
// inclusive-by-design promise applied to the candidate's own document.
const BIAS_INVITING: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(?:date\s+of\s+birth|d\.?o\.?b\.?|age\s*[:\-]?\s*\d{1,2}\b|\b\d{1,2}\s+years?\s+old)\b/i, label: "age or date of birth" },
  { pattern: /\b(?:marital\s+status|married|unmarried|single\s*\/\s*married|divorced)\b/i, label: "marital status" },
  { pattern: /\b(?:religion|caste|hindu|muslim|christian|sikh)\b/i, label: "religion or caste" },
  { pattern: /\b(?:father'?s?\s+name|mother'?s?\s+name|spouse'?s?\s+name)\b/i, label: "family details" },
  { pattern: /\b(?:gender|sex)\s*[:\-]/i, label: "gender" },
  { pattern: /\b(?:photograph|photo\s+attached|passport\s+size)\b/i, label: "a photo" },
  { pattern: /\bnationality\s*[:\-]/i, label: "nationality" },
];

const IMPACT_VERBS = [
  "increased", "reduced", "improved", "saved", "launched", "led", "built", "created", "designed",
  "delivered", "grew", "cut", "automated", "streamlined", "organised", "organized", "won", "raised",
  "trained", "mentored", "shipped", "published", "resolved",
];

const IRREGULAR_PAST: Record<string, string> = {
  running: "Ran", making: "Made", leading: "Led", building: "Built", writing: "Wrote",
  taking: "Took", holding: "Held", keeping: "Kept", teaching: "Taught", giving: "Gave",
  setting: "Set", selling: "Sold", speaking: "Spoke", winning: "Won", finding: "Found",
  bringing: "Brought", meeting: "Met", growing: "Grew", drawing: "Drew", sending: "Sent",
};

function toPastTense(word: string): string {
  const lower = word.toLowerCase();
  if (IRREGULAR_PAST[lower]) return IRREGULAR_PAST[lower];
  if (!lower.endsWith("ing")) return word.charAt(0).toUpperCase() + word.slice(1);
  const stem = lower.slice(0, -3);
  const past = /e$/.test(stem) ? `${stem}d` : `${stem}ed`;
  return past.charAt(0).toUpperCase() + past.slice(1);
}

function hasPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(text);
}

/** Split into reviewable lines: bullet points, or sentences when prose. */
function toLines(text: string): string[] {
  const byLine = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-•*·—]\s*/, "").trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;
  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function reviewLine(line: string): BulletNote | null {
  const issues: string[] = [];
  let rewrite = line.trim();

  const weak = WEAK_OPENERS.find((entry) => entry.pattern.test(rewrite));
  if (weak) {
    issues.push("Buries what you did behind a passive opener");
    const rest = rewrite.replace(weak.pattern, "").trim();
    const [firstWord, ...others] = rest.split(/\s+/);
    // "responsible for managing X" reads best as "Managed X", not "Owned managing X".
    rewrite = firstWord && /ing$/i.test(firstWord)
      ? `${toPastTense(firstWord)} ${others.join(" ")}`.trim()
      : `${weak.verb} ${rest}`.trim();
  }

  if (!/\d/.test(line)) {
    issues.push("No number, so the scale is invisible");
  }

  const filler = FILLER.filter((word) => hasPhrase(line, word));
  if (filler.length) {
    issues.push(`Vague wording (“${filler[0]}”) — say the actual amount`);
  }

  const cliche = CLICHES.filter((phrase) => hasPhrase(line, phrase));
  if (cliche.length) {
    issues.push(`“${cliche[0]}” is a claim anyone can make — show it instead`);
  }

  if (/\b(?:was|were|been|is|are)\s+\w+(?:ed|en)\b/i.test(line)) {
    issues.push("Passive voice hides who did the work");
  }

  if (!issues.length) return null;

  // A line that is only self-description can't be improved by editing it —
  // the fix is to replace it with the example that proves the claim.
  if (cliche.length && !/\d/.test(line) && !weak) {
    return {
      original: line.trim(),
      issues,
      rewrite: "Cut this line and prove it instead — e.g. “Coordinated a 6-person team to run the annual fest for 400 students.”",
    };
  }

  // Swap the vague quantity for a placeholder so the gap is obvious.
  for (const word of filler) {
    rewrite = rewrite.replace(new RegExp(`\\b${word}\\b`, "gi"), "[how many]");
  }

  if (!/\d/.test(rewrite) && !rewrite.includes("[how many]")) {
    rewrite = `${rewrite.replace(/[.\s]+$/, "")} — add the result (how many, how much, how fast).`;
  }

  return { original: line.trim(), issues, rewrite };
}

export function reviewResume(resume: string, requiredSkills: string[] = []): ResumeReview {
  const text = resume.trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const lines = toLines(text);
  const checks: ReviewCheck[] = [];

  // 1. Quantified impact. Dates, years, phone numbers and emails are not
  // achievements — counting "Date of Birth: 12/04/2005" as evidence of scale
  // would hand out a passing grade for the exact content we tell them to cut.
  const measurable = text
    .replace(/[\w.+-]+@[\w.-]+/g, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\+?\d[\d\s-]{8,}\d/g, " ");
  const numbers = measurable.match(/\b\d[\d,.]*\s*%?/g) ?? [];
  checks.push(
    numbers.length >= 3
      ? { label: "Quantified impact", status: "pass", detail: `${numbers.length} concrete numbers found.`, fix: "" }
      : {
          label: "Quantified impact",
          status: numbers.length ? "warn" : "fail",
          detail: numbers.length
            ? `Only ${numbers.length} number${numbers.length === 1 ? "" : "s"} in the whole résumé.`
            : "No numbers anywhere in your résumé.",
          fix: "Add scale to at least three lines: people helped, hours saved, % improved, items handled.",
        },
  );

  // 2. Strong openers
  const weakLines = lines.filter((line) => WEAK_OPENERS.some((entry) => entry.pattern.test(line)));
  checks.push(
    weakLines.length === 0
      ? { label: "Strong action verbs", status: "pass", detail: "Your lines lead with what you did.", fix: "" }
      : {
          label: "Strong action verbs",
          status: weakLines.length > 2 ? "fail" : "warn",
          detail: `${weakLines.length} line${weakLines.length === 1 ? "" : "s"} start with phrases like “${weakLines[0].split(/\s+/).slice(0, 3).join(" ")}…”.`,
          fix: "Open with the verb: Built, Led, Ran, Designed, Cut, Trained.",
        },
  );

  // 3. Evidence over adjectives
  const clichesFound = CLICHES.filter((phrase) => hasPhrase(text, phrase));
  checks.push(
    clichesFound.length === 0
      ? { label: "Evidence over adjectives", status: "pass", detail: "No filler self-description.", fix: "" }
      : {
          label: "Evidence over adjectives",
          status: clichesFound.length > 1 ? "fail" : "warn",
          detail: `Found ${clichesFound.map((phrase) => `“${phrase}”`).join(", ")}.`,
          fix: "Delete the adjective and describe the moment that proves it.",
        },
  );

  // 4. Impact verbs
  const impactUsed = IMPACT_VERBS.filter((verb) => hasPhrase(text, verb));
  checks.push(
    impactUsed.length >= 3
      ? { label: "Outcome language", status: "pass", detail: `Uses ${impactUsed.slice(0, 3).join(", ")}.`, fix: "" }
      : {
          label: "Outcome language",
          status: impactUsed.length ? "warn" : "fail",
          detail: impactUsed.length ? `Only ${impactUsed.length} outcome verb(s).` : "Describes duties, not outcomes.",
          fix: "Use verbs that imply a change: increased, reduced, launched, automated, trained.",
        },
  );

  // 5. Length
  const lengthOk = wordCount >= 60 && wordCount <= 700;
  checks.push(
    lengthOk
      ? { label: "Length", status: "pass", detail: `${wordCount} words — a readable length.`, fix: "" }
      : {
          label: "Length",
          status: wordCount < 30 ? "fail" : "warn",
          detail: wordCount < 60 ? `Only ${wordCount} words.` : `${wordCount} words is long for an early-career résumé.`,
          fix: wordCount < 60
            ? "Add your projects, coursework, volunteering and part-time work — they count as experience."
            : "Cut to the strongest lines. One page is enough at this stage.",
        },
  );

  // 6. Bias-inviting personal details
  const biasFound = BIAS_INVITING.filter((entry) => entry.pattern.test(text)).map((entry) => entry.label);
  checks.push(
    biasFound.length === 0
      ? { label: "Nothing that invites bias", status: "pass", detail: "No age, marital status, religion or photo.", fix: "" }
      : {
          label: "Nothing that invites bias",
          status: "warn",
          detail: `Your résumé includes ${biasFound.join(", ")}.`,
          fix: "These are not job-relevant and can trigger bias. Removing them costs you nothing.",
        },
  );

  // 7. Coverage of what the target role actually asks for
  const missingKeywords = requiredSkills.filter((skill) => !hasPhrase(text, skill.toLowerCase()));
  if (requiredSkills.length) {
    const covered = requiredSkills.length - missingKeywords.length;
    checks.push(
      missingKeywords.length === 0
        ? { label: "Matches the job post", status: "pass", detail: "Every skill the listing names appears in your résumé.", fix: "" }
        : {
            label: "Matches the job post",
            status: covered === 0 ? "fail" : "warn",
            detail: `${covered} of ${requiredSkills.length} skills from the listing appear in your résumé.`,
            fix: `Where you have genuine experience, name it: ${missingKeywords.slice(0, 3).join(", ")}. Never claim what you cannot back up.`,
          },
    );
  }

  const bullets = lines.map(reviewLine).filter((note): note is BulletNote => note !== null).slice(0, 6);

  const weights = { pass: 1, warn: 0.5, fail: 0 } as const;
  const score = checks.length
    ? Math.round((checks.reduce((sum, check) => sum + weights[check.status], 0) / checks.length) * 100)
    : 0;

  return { score, wordCount, checks, bullets, missingKeywords };
}
