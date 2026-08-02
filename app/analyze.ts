// Generic job-description analyzer.
//
// Reads the skills a listing actually asks for, then looks for evidence of each
// one in the candidate's own words. Every score traces back to a quote from the
// candidate's text (or an explicit "not found yet"), which is the product's
// core promise: explain the signal, never hand down an unexplained verdict.

export type Skill = {
  name: string;
  score: number;
  status: "strong" | "build";
  evidence: string;
};

export type Analysis = {
  role: string;
  company: string;
  score: number;
  skills: Skill[];
  strengths: string[];
  gaps: string[];
  questions: string[];
};

type SkillDef = {
  name: string;
  /** Implied by real achievements even when the word never appears. */
  transferable?: boolean;
  /** Any of these appearing in the listing means the role wants this skill. */
  terms: string[];
  /** Adjacent experience — partial credit, and named in the explanation. */
  related?: string[];
};

// Ordered roughly by how specific the skill is: concrete tools first, so a
// listing that mentions both "React" and "communication" surfaces React first.
const SKILLS: SkillDef[] = [
  // Engineering
  { name: "React", terms: ["react", "react.js", "reactjs"], related: ["javascript", "frontend", "component", "jsx"] },
  { name: "TypeScript", terms: ["typescript", "ts"], related: ["javascript", "types", "node"] },
  { name: "JavaScript", terms: ["javascript", "js", "es6"], related: ["html", "css", "web", "frontend"] },
  { name: "Node.js", terms: ["node.js", "nodejs", "node"], related: ["javascript", "backend", "api", "express"] },
  { name: "Python", terms: ["python", "django", "flask"], related: ["script", "automation", "pandas", "data"] },
  { name: "Java", terms: ["java", "spring"], related: ["object-oriented", "backend"] },
  { name: "C++", terms: ["c++", "cpp"], related: ["c language", "algorithms", "systems"] },
  { name: "C#", terms: ["c#", ".net", "dotnet"], related: ["object-oriented", "backend"] },
  { name: "PHP", terms: ["php", "laravel"], related: ["backend", "wordpress", "web"] },
  { name: "Ruby", terms: ["ruby", "rails"], related: ["backend", "web"] },
  { name: "Go", terms: ["golang"], related: ["backend", "systems"] },
  { name: "Mobile development", terms: ["android", "ios", "swift", "kotlin", "flutter", "react native"], related: ["mobile", "app"] },
  { name: "HTML & CSS", terms: ["html", "css", "sass", "tailwind"], related: ["web", "responsive", "frontend"] },
  { name: "Responsive UI", terms: ["responsive", "mobile-first", "cross-browser"], related: ["css", "html", "layout"] },
  { name: "APIs", terms: ["api", "rest", "restful", "graphql", "endpoint"], related: ["backend", "integration", "json"] },
  { name: "Databases", terms: ["database", "postgres", "postgresql", "mysql", "mongodb", "nosql"], related: ["sql", "data", "query"] },
  { name: "SQL", terms: ["sql", "queries", "joins"], related: ["database", "data", "excel", "analysis"] },
  { name: "Testing", terms: ["testing", "unit test", "jest", "pytest", "qa", "test automation"], related: ["debug", "quality", "review"] },
  { name: "Git collaboration", terms: ["git", "github", "gitlab", "version control", "code review"], related: ["collaborate", "team", "branch", "repository"] },
  { name: "Cloud platforms", terms: ["aws", "azure", "gcp", "google cloud", "cloud"], related: ["deploy", "server", "hosting"] },
  { name: "DevOps", terms: ["docker", "kubernetes", "ci/cd", "jenkins", "terraform"], related: ["deploy", "pipeline", "automation", "linux"] },

  // Data
  { name: "Data analysis", terms: ["data analysis", "analyze data", "data analyst", "analytics", "insights"], related: ["excel", "report", "dashboard", "survey", "statistics"] },
  { name: "Data visualization", terms: ["visualization", "dashboard", "power bi", "tableau", "looker", "charts"], related: ["excel", "report", "present", "graph"] },
  { name: "Spreadsheet analysis", terms: ["excel", "spreadsheet", "google sheets", "pivot", "vlookup"], related: ["data", "report", "formula", "budget"] },
  { name: "Statistics", terms: ["statistics", "statistical", "regression", "hypothesis", "a/b test"], related: ["data", "analysis", "research", "math"] },
  { name: "Machine learning", terms: ["machine learning", "ml", "deep learning", "tensorflow", "pytorch", "ai model"], related: ["python", "data", "model", "algorithm"] },
  { name: "Data cleaning", terms: ["data cleaning", "etl", "data pipeline", "data quality", "wrangling"], related: ["data", "excel", "script", "survey"] },

  // Design
  { name: "Figma prototyping", terms: ["figma", "prototype", "prototyping", "adobe xd", "sketch"], related: ["design", "mockup", "wireframe", "canva"] },
  { name: "User research", terms: ["user research", "user interview", "usability test", "user testing", "discovery"], related: ["interview", "survey", "feedback", "research", "users"] },
  { name: "UX design", terms: ["ux", "user experience", "user journey", "information architecture", "wireframe"], related: ["design", "usability", "flow", "prototype"] },
  { name: "Visual design", terms: ["visual design", "ui design", "typography", "branding", "illustrator", "photoshop"], related: ["design", "canva", "layout", "colour", "color"] },
  { name: "Accessibility", terms: ["accessibility", "a11y", "wcag", "screen reader", "inclusive design"], related: ["semantic", "contrast", "usability", "inclusive"] },
  { name: "Design systems", terms: ["design system", "component library", "style guide"], related: ["figma", "component", "consistent", "design"] },

  // Marketing / content
  { name: "Content writing", terms: ["content writing", "copywriting", "blog", "content creation", "editorial"], related: ["write", "writing", "article", "communication"] },
  { name: "SEO", terms: ["seo", "search engine optimization", "keyword research"], related: ["content", "marketing", "traffic", "analytics"] },
  { name: "Social media", terms: ["social media", "instagram", "linkedin", "twitter", "community management"], related: ["content", "marketing", "engagement", "posts"] },
  { name: "Marketing analytics", terms: ["google analytics", "campaign", "conversion", "marketing analytics"], related: ["data", "analytics", "report", "metrics"] },

  // Business / ops
  { name: "Project management", terms: ["project management", "agile", "scrum", "kanban", "jira", "sprint planning"], related: ["organize", "coordinate", "deadline", "plan", "team"] },
  { name: "Stakeholder management", terms: ["stakeholder", "client management", "cross-functional", "business partner"], related: ["communicate", "team", "collaborate", "present"] },
  { name: "Financial analysis", terms: ["financial", "budget", "forecasting", "accounting", "p&l"], related: ["excel", "numbers", "cost", "analysis"] },
  { name: "Customer support", terms: ["customer support", "customer service", "helpdesk", "client support"], related: ["communicate", "help", "resolve", "users"] },
  { name: "Sales", terms: ["sales", "business development", "lead generation", "crm", "outreach"], related: ["client", "communicate", "target", "customer"] },
  { name: "Teaching & training", terms: ["teach", "teaching", "train", "training", "mentor", "mentoring", "onboard", "curriculum", "tutor"], related: ["explain", "workshop", "peer", "students", "coach"] },
  { name: "Operations", terms: ["operations", "logistics", "supply chain", "inventory", "process improvement"], related: ["organize", "coordinate", "efficiency", "process"] },
  { name: "Research", terms: ["research", "literature review", "qualitative", "quantitative"], related: ["study", "analysis", "survey", "investigate"] },

  // Transferable
  { transferable: true, name: "Communication", terms: ["communication", "communicate", "presenting", "presentation", "articulate"], related: ["explain", "present", "wrote", "report", "peer", "team"] },
  { transferable: true, name: "Teamwork", terms: ["teamwork", "collaborate", "collaboration", "team player"], related: ["team", "group", "peer", "together", "coordinator"] },
  { transferable: true, name: "Problem solving", terms: ["problem solving", "problem-solving", "analytical thinking", "critical thinking"], related: ["solve", "debug", "improve", "figure out", "fixed"] },
  { transferable: true, name: "Leadership", terms: ["leadership", "lead a team", "manage a team", "ownership"], related: ["led", "organized", "coordinator", "captain", "president", "founder"] },
  { transferable: true, name: "Attention to detail", terms: ["attention to detail", "detail-oriented", "detailed", "accuracy", "accurate", "meticulous"], related: ["careful", "checked", "reviewed", "quality", "records", "proofread"] },
  { transferable: true, name: "Adaptability", terms: ["adaptability", "fast-paced", "ambiguity", "self-starter", "proactive"], related: ["learned", "picked up", "new", "quickly"] },
];

// Whole-token match so "ts" doesn't fire inside "sports" or "js" inside "jsx",
// but tolerant of ordinary inflections: a CV saying "communicated daily with
// families" is direct evidence of "communicate", not merely adjacent.
const INFLECTIONS = "(?:s|es|d|ed|ing|ion|ions|er|ers|ly)?";

function termRegex(term: string): RegExp {
  let base = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "communicate" -> "communicat(e)?" so "communicating" matches too. Guarded
  // by length so "care" never degrades into matching the word "car".
  if (/[a-z]e$/.test(term) && term.length >= 6) base = `${base.slice(0, -1)}e?`;
  return new RegExp(`(?:^|[^a-z0-9])${base}${INFLECTIONS}(?:[^a-z0-9]|$)`, "i");
}

function hasTerm(haystack: string, term: string): boolean {
  return termRegex(term).test(haystack);
}

const ACTION_VERB =
  /\b(?:built|led|ran|created|design|develop|analys|analyz|manag|wrote|writ|automat|present|deliver|improv|reduc|increas|organis|organiz|train|coordinat|launch|handl|clean|optimis|optimiz|implement|conduct|research|tested|testing|maintain|resolv|schedul|taught|mentor|volunteer|process|track|monitor|review|edit|publish|sold|raised|won|cut|saved|grew|built|ship|fix)\w*\b/i;

/** Self-description anyone can write, with nothing behind it. */
const SELF_CLAIM =
  /\b(?:i\s+am|i'm|hard[-\s]?working|hardworking|team\s+player|good\s+communication|excellent\s+communication|strong\s+communication|self[-\s]?motivated|detail[-\s]?oriented|go[-\s]?getter|passionate\s+about|results[-\s]?driven|dynamic\s+individual|quick\s+learner)\b/i;

/**
 * How well a sentence actually evidences a skill.
 *
 * Naming a skill is not the same as showing it. Without this, a résumé that
 * merely lists "Communication, teamwork" outscores one that describes
 * coordinating a team but never uses the word — which inverts the ranking and
 * rewards exactly the buzzword padding this product tells people to remove.
 */
function evidenceTier(sentence: string | null): "quantified" | "demonstrated" | "mentioned" | "claimed" {
  if (!sentence) return "mentioned";
  if (SELF_CLAIM.test(sentence)) return "claimed";

  const hasAction = ACTION_VERB.test(sentence);
  // A bare comma-separated run with no verb is a skills list, not evidence.
  if (!hasAction && (sentence.match(/,/g) ?? []).length >= 2) return "claimed";
  if (hasAction && /\d/.test(sentence)) return "quantified";
  if (hasAction) return "demonstrated";
  return "mentioned";
}

/** Tentative phrasing — the skill is named, but not yet demonstrated. */
const HEDGED =
  /\b(?:learning|beginner|basic|basics|familiar with|some exposure|exposure to|interested in|starting to|want(?:ing)? to learn|currently studying|no experience)\b/i;

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const QUOTE_MAX = 104;

/**
 * The candidate's own words backing a skill — this is the "evidence".
 * Long sentences are windowed *around the matched phrase* rather than truncated
 * from the start, so the quote always contains the thing it is evidence of.
 */
function quoteFor(profileSentences: string[], terms: string[]): string | null {
  for (const raw of profileSentences) {
    const sentence = raw.replace(/\s+/g, " ").trim();
    for (const term of terms) {
      const match = termRegex(term).exec(sentence);
      if (!match) continue;
      if (sentence.length <= QUOTE_MAX) return sentence;

      const centre = match.index + Math.floor(match[0].length / 2);
      let start = Math.max(0, centre - Math.floor(QUOTE_MAX / 2));
      let end = Math.min(sentence.length, start + QUOTE_MAX);
      start = Math.max(0, end - QUOTE_MAX);

      // Snap outward to whole words so the quote doesn't start mid-word.
      if (start > 0) {
        const space = sentence.indexOf(" ", start);
        if (space !== -1 && space < centre) start = space + 1;
      }
      if (end < sentence.length) {
        const space = sentence.lastIndexOf(" ", end);
        if (space !== -1 && space > centre) end = space;
      }

      return `${start > 0 ? "…" : ""}${sentence.slice(start, end).trim()}${end < sentence.length ? "…" : ""}`;
    }
  }
  return null;
}

const TITLE_WORDS =
  "(?:analyst|engineer|developer|designer|manager|scientist|intern|associate|assistant|specialist|coordinator|consultant|writer|marketer|researcher|architect|administrator|technician|executive|officer|lead|strategist|producer|editor|accountant|recruiter|teacher|nurse|planner)";

export function extractRole(listing: string): string {
  const text = listing.replace(/\s+/g, " ").trim();
  if (!text) return "This role";

  // "Junior Data Analyst at GreenGrid" / "Frontend Developer intern at X"
  const atMatch = text.match(
    new RegExp(`([A-Za-z][\\w/&+-]*(?:\\s+[A-Za-z][\\w/&+-]*){0,4}\\s+${TITLE_WORDS}\\w*)\\s+(?:at|@|-|–|,)\\s`, "i"),
  );
  if (atMatch) return titleCase(atMatch[1]);

  // "We're hiring a Senior Product Manager" / "looking for a UX Designer"
  const hiringMatch = text.match(
    new RegExp(`(?:hiring|seeking|looking for|recruiting)\\s+(?:an?\\s+)?([A-Za-z][\\w/&+-]*(?:\\s+[A-Za-z][\\w/&+-]*){0,4}\\s+${TITLE_WORDS}\\w*)`, "i"),
  );
  if (hiringMatch) return titleCase(hiringMatch[1]);

  // Any title-shaped phrase anywhere in the listing.
  const anyMatch = text.match(
    new RegExp(`([A-Za-z][\\w/&+-]*(?:\\s+[A-Za-z][\\w/&+-]*){0,3}\\s+${TITLE_WORDS}\\w*)`, "i"),
  );
  if (anyMatch) return titleCase(anyMatch[1]);

  const firstLine = text.split(/[.\n]/)[0] ?? "";
  if (firstLine && firstLine.length <= 60) return titleCase(firstLine);
  return "This role";
}

// "St." / "Inc." end a token without ending the sentence; anything else with a
// trailing period does, so the capture must stop there.
const ABBREVIATIONS = new Set(["st.", "inc.", "ltd.", "co.", "corp.", "llc.", "pvt.", "mt.", "dr."]);

/** Trim a capitalized-token run at the first real sentence end. */
function trimAtSentenceEnd(capture: string): string {
  const kept: string[] = [];
  for (const token of capture.split(/\s+/)) {
    kept.push(token);
    if (token.endsWith(".") && !ABBREVIATIONS.has(token.toLowerCase())) break;
  }
  return kept.join(" ").replace(/[.,;:]$/, "").trim();
}

export function extractCompany(listing: string): string {
  const text = listing.replace(/\s+/g, " ").trim();
  const atMatch = text.match(/\bat\s+([A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*){0,3})/);
  if (atMatch) return trimAtSentenceEnd(atMatch[1]) || "this employer";
  const joinMatch = text.match(/\bjoin\s+(?:the\s+team\s+at\s+)?([A-Z][\w&.'’-]*(?:\s+[A-Z][\w&.'’-]*){0,2})/);
  if (joinMatch) return trimAtSentenceEnd(joinMatch[1]) || "this employer";
  return "this employer";
}

function titleCase(value: string): string {
  const cleaned = value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]$/, "")
    // Drop recruiting boilerplate the title pattern picks up on the way in
    // ("We are hiring a Social Media Marketing Intern" -> the title only).
    .replace(/^(?:we(?:'re| are)?\s+|is\s+|are\s+|now\s+|currently\s+|hiring\s+|seeking\s+|looking\s+for\s+|recruiting\s+|an?\s+|the\s+)+/i, "");
  return cleaned
    .split(" ")
    .map((word) =>
      word.length <= 2 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function buildQuestions(role: string, skills: Skill[]): string[] {
  const strong = skills.filter((skill) => skill.status === "strong");
  const gaps = skills.filter((skill) => skill.status === "build");
  const questions: string[] = [];

  if (strong[0]) {
    questions.push(`Tell me about a time you used ${strong[0].name} to solve a real problem.`);
  } else if (skills[0]) {
    questions.push(`What draws you to work involving ${skills[0].name}?`);
  }

  if (gaps[0]) {
    questions.push(`This role leans on ${gaps[0].name}. How would you get up to speed in your first month?`);
  }

  if (skills[1]) {
    questions.push(`Walk me through a project where ${skills[1].name} mattered, and what you would do differently.`);
  }

  questions.push(`Why do you want this ${role.toLowerCase()} role, and what would you contribute first?`);
  questions.push("Describe a time you received difficult feedback. What did you change?");
  questions.push("Tell me about something you taught yourself recently and how you did it.");

  return questions.slice(0, 3);
}

export function analyzeListing(listing: string, profile: string): Analysis {
  const jd = listing.toLowerCase();
  const cv = profile.toLowerCase();
  const profileSentences = sentences(profile);
  const role = extractRole(listing);
  const company = extractCompany(listing);

  // Rank required skills by where they first appear — listings tend to lead
  // with what matters most.
  const required = SKILLS.map((skill) => {
    const positions = skill.terms
      .map((term) => {
        const match = termRegex(term).exec(jd);
        return match ? match.index : -1;
      })
      .filter((index) => index >= 0);
    return positions.length ? { skill, position: Math.min(...positions) } : null;
  })
    .filter((entry): entry is { skill: SkillDef; position: number } => entry !== null)
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.skill)
    .slice(0, 6);

  // A thin or unusual listing shouldn't produce a one-row map. Top up with
  // transferable skills every job implies, rather than inventing requirements.
  const fallbackNames = ["Communication", "Teamwork", "Problem solving", "Adaptability"];
  const chosen = [...required];
  for (const name of fallbackNames) {
    if (chosen.length >= 4) break;
    if (chosen.some((skill) => skill.name === name)) continue;
    const fallback = SKILLS.find((skill) => skill.name === name);
    if (fallback) chosen.push(fallback);
  }

  const words = profile.trim().split(/\s+/).filter(Boolean).length;
  const depthBonus = Math.min(6, Math.floor(words / 40));

  // Someone who ran projects and shipped results plainly communicates, solves
  // problems and adapts — whether or not they wrote those words down. Judging
  // transferable skills purely on keywords punishes the substantive résumé and
  // rewards the padded one.
  const achievements = profileSentences.filter(
    (sentence) => evidenceTier(sentence) === "quantified" || evidenceTier(sentence) === "demonstrated",
  ).length;

  const skills: Skill[] = chosen.map((skill) => {
    const directTerm = skill.terms.find((term) => hasTerm(cv, term));
    if (directTerm) {
      const quote = quoteFor(profileSentences, skill.terms);
      const quantified = quote ? /\d/.test(quote) : false;
      // "Learning SQL" is not the same as having shipped something with SQL.
      // Naming a skill tentatively shouldn't read as proven evidence.
      const hedged = quote ? HEDGED.test(quote) : false;
      if (hedged) {
        return {
          name: skill.name,
          score: Math.min(70, 52 + depthBonus),
          status: "build",
          evidence: `You mention ${skill.name}, but as something in progress: “${quote}” — a finished project would make this count.`,
        };
      }
      const tier = evidenceTier(quote);
      if (tier === "claimed") {
        return {
          name: skill.name,
          score: Math.min(58, 46 + Math.floor(depthBonus / 2)),
          status: "build",
          evidence: quote
            ? `You claim ${skill.name}, but only as a description: “${quote}” — show it with something you did.`
            : `${skill.name} is listed, but never demonstrated.`,
        };
      }

      const base = tier === "quantified" ? 88 : tier === "demonstrated" ? 78 : 64;
      const ceiling = tier === "quantified" ? 96 : tier === "demonstrated" ? 88 : 72;
      return {
        name: skill.name,
        score: Math.min(ceiling, base + depthBonus + (quantified ? 2 : 0)),
        status: tier === "mentioned" ? "build" : "strong",
        evidence: quote
          ? tier === "quantified"
            ? `Proven with a result: “${quote}”`
            : tier === "demonstrated"
              ? `Your words: “${quote}”`
              : `Mentioned, but not shown in action: “${quote}”`
          : `You mention ${directTerm} in your experience.`,
      };
    }

    const relatedTerm = (skill.related ?? []).find((term) => hasTerm(cv, term));
    if (relatedTerm) {
      const quote = quoteFor(profileSentences, skill.related ?? []);
      return {
        name: skill.name,
        // Adjacent real experience outranks an unbacked buzzword claim.
        score: Math.min(66, 54 + depthBonus),
        status: "build",
        evidence: quote
          ? `Adjacent evidence (“${relatedTerm}”), but not ${skill.name} directly: “${quote}”`
          : `Related experience found, but no direct ${skill.name} proof yet.`,
      };
    }

    if (skill.transferable && achievements >= 2) {
      return {
        name: skill.name,
        score: Math.min(64, 44 + achievements * 3),
        status: "build",
        evidence: `You never use the word, but ${achievements} of your lines describe real work that implies it — name it explicitly and it becomes provable.`,
      };
    }

    return {
      name: skill.name,
      score: Math.max(12, 24 - Math.floor(depthBonus / 2)),
      status: "build",
      evidence: `Not found in your experience yet — this is the clearest thing to build proof for.`,
    };
  });

  // Weight by how prominently the listing mentions each skill (they lead with
  // what matters). A flat mean let one missing nice-to-have drag a genuinely
  // well-matched candidate down to ~50, which reads as "barely qualified" —
  // exactly the discouraging verdict this tool exists to avoid.
  const weighted = skills.reduce(
    (acc, skill, index) => {
      const weight = skills.length - index;
      return { total: acc.total + skill.score * weight, weight: acc.weight + weight };
    },
    { total: 0, weight: 0 },
  );
  const average = Math.round(weighted.total / Math.max(1, weighted.weight));
  const strengths = skills.filter((skill) => skill.status === "strong").map((skill) => skill.name);
  const gaps = skills.filter((skill) => skill.status === "build").map((skill) => skill.name);

  return {
    role,
    company,
    score: average,
    skills,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
    questions: buildQuestions(role, skills),
  };
}
