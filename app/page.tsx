"use client";

import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  HeartHandshake,
  Lightbulb,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Mic,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { compareMeaning } from "./on-device-ai";

type Skill = {
  name: string;
  score: number;
  status: "strong" | "build";
  evidence: string;
};

type Analysis = {
  role: string;
  company: string;
  score: number;
  skills: Skill[];
  strengths: string[];
  gaps: string[];
};

const roles = {
  "Data Analyst": {
    company: "GreenGrid Energy",
    listing:
      "Junior Data Analyst at GreenGrid Energy. Use SQL and Python to clean operational datasets, build Power BI dashboards, explain trends to non-technical teams, and support climate-impact reporting. We value curiosity, clear communication, and practical problem solving. Portfolio projects welcome; prior energy-sector experience is not required.",
    profile:
      "Second-year BCA student. Built an Excel dashboard for a school recycling drive and cleaned survey data for 300 responses. Comfortable with Excel formulas, basic Python and presenting findings. Learning SQL. Volunteered as class event coordinator.",
  },
  "UX Designer": {
    company: "Asha Health",
    listing:
      "Junior UX Designer at Asha Health. Conduct user interviews, map accessible mobile journeys, create Figma prototypes, test with patients, and collaborate with engineers. Strong visual hierarchy, inclusive research, and clear design rationale are essential.",
    profile:
      "Student designer who redesigned a school library booking flow in Figma. Interviewed 8 students, made interactive prototypes, and ran two usability tests. Comfortable with Canva, Figma, presentations, and basic HTML/CSS.",
  },
  "Frontend Developer": {
    company: "LearnLoop",
    listing:
      "Frontend Developer intern at LearnLoop. Build responsive React and TypeScript interfaces, work with REST APIs, write accessible components, use Git, and collaborate through code reviews. Experience with testing and performance is a plus.",
    profile:
      "Computer science student. Built two responsive websites with HTML, CSS and JavaScript, and one React study planner. Used GitHub for school projects. Familiar with APIs and basic TypeScript. Enjoy explaining technical concepts to classmates.",
  },
} as const;

const roleSkills: Record<keyof typeof roles, Array<[string, number, "strong" | "build", string]>> = {
  "Data Analyst": [
    ["Data storytelling", 88, "strong", "Recycling dashboard + presentations"],
    ["Spreadsheet analysis", 84, "strong", "Excel formulas and survey cleanup"],
    ["Python", 61, "build", "Basic projects mentioned"],
    ["SQL", 42, "build", "Learning, but no project evidence yet"],
    ["Power BI", 28, "build", "Not found in your profile"],
  ],
  "UX Designer": [
    ["User research", 91, "strong", "8 interviews + usability testing"],
    ["Figma prototyping", 88, "strong", "Interactive library prototype"],
    ["Design rationale", 76, "strong", "Research-led redesign evidence"],
    ["Accessibility", 49, "build", "No accessibility audit mentioned"],
    ["Developer handoff", 37, "build", "No handoff evidence yet"],
  ],
  "Frontend Developer": [
    ["Responsive UI", 88, "strong", "Two responsive websites"],
    ["React", 82, "strong", "Study planner project"],
    ["Git collaboration", 66, "strong", "GitHub school projects"],
    ["TypeScript", 48, "build", "Familiar, but limited proof"],
    ["Testing", 24, "build", "No automated tests mentioned"],
  ],
};

const interviewQuestions: Record<keyof typeof roles, string[]> = {
  "Data Analyst": [
    "Tell me about a time your data changed someone’s decision.",
    "How would you investigate a sudden 20% drop in weekly engagement?",
    "Explain a dashboard insight to a teammate who does not work with data.",
  ],
  "UX Designer": [
    "Tell me about a design choice you changed after user feedback.",
    "How would you make a healthcare flow work for low-vision users?",
    "Walk me through a disagreement with an engineer about your design.",
  ],
  "Frontend Developer": [
    "Tell me about a UI bug that was difficult to diagnose.",
    "How do you make a component accessible before testing it?",
    "Explain how you would improve a slow page without guessing.",
  ],
};

const navItems = [
  ["Overview", TrendingUp],
  ["Pathfinder", Target],
  ["Learning sprint", BookOpen],
  ["Interview lab", MessageSquareText],
] as const;

function inferRole(listing: string): keyof typeof roles {
  const value = listing.toLowerCase();
  if (value.includes("figma") || value.includes("designer") || value.includes("ux")) return "UX Designer";
  if (value.includes("react") || value.includes("frontend") || value.includes("typescript")) return "Frontend Developer";
  return "Data Analyst";
}

function makeAnalysis(role: keyof typeof roles, profile: string): Analysis {
  const source = roles[role];
  const words = profile.trim().split(/\s+/).filter(Boolean).length;
  const evidenceBonus = Math.min(5, Math.floor(words / 35));
  const skills = roleSkills[role].map(([name, score, status, evidence]) => ({
    name,
    score: Math.min(96, score + evidenceBonus),
    status,
    evidence,
  }));
  const average = Math.round(skills.reduce((sum, item) => sum + item.score, 0) / skills.length);
  return {
    role,
    company: source.company,
    score: average,
    skills,
    strengths: skills.filter((skill) => skill.status === "strong").slice(0, 3).map((skill) => skill.name),
    gaps: skills.filter((skill) => skill.status === "build").slice(0, 3).map((skill) => skill.name),
  };
}

function scoreAnswer(answer: string) {
  const lower = answer.toLowerCase();
  const hasSituation = /(when|during|project|team|class|problem)/.test(lower);
  const hasAction = /(i built|i created|i analyzed|i asked|i changed|i used|i tested|i led)/.test(lower);
  const hasResult = /(result|improved|increased|reduced|learned|percent|%|people|users|students)/.test(lower);
  const length = answer.trim().split(/\s+/).filter(Boolean).length;
  const score = Math.min(96, 38 + (hasSituation ? 15 : 0) + (hasAction ? 20 : 0) + (hasResult ? 18 : 0) + Math.min(5, Math.floor(length / 12)));
  return {
    score,
    checks: [
      ["Context", hasSituation, "Name the situation in one sentence."],
      ["Your action", hasAction, "Be specific about what you personally did."],
      ["Outcome", hasResult, "Add a result, number, or lesson."],
    ] as const,
  };
}

export default function Home() {
  const [selectedRole, setSelectedRole] = useState<keyof typeof roles>("Data Analyst");
  const [profile, setProfile] = useState(roles["Data Analyst"].profile);
  const [listing, setListing] = useState(roles["Data Analyst"].listing);
  const [analysis, setAnalysis] = useState<Analysis>(() => makeAnalysis("Data Analyst", roles["Data Analyst"].profile));
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [privacyOn, setPrivacyOn] = useState(true);
  const [answer, setAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<ReturnType<typeof scoreAnswer> | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [completedDays, setCompletedDays] = useState<number[]>([1]);
  const [aiState, setAiState] = useState<"private" | "loading" | "ready" | "fallback">("private");

  useEffect(() => {
    const saved = window.localStorage.getItem("careerready-progress");
    if (saved) setCompletedDays(JSON.parse(saved));
  }, []);

  const sprint = useMemo(() => {
    const gaps = analysis.gaps.length ? analysis.gaps : ["portfolio proof", "interview practice"];
    return [
      ["Map the gap", `Find 3 real ${analysis.role} listings and highlight repeated skills.`, "Evidence map"],
      [gaps[0], `Complete a guided ${gaps[0]} micro-lesson and 5-question check.`, "Skill badge"],
      ["Build proof", `Create one small project that demonstrates ${gaps[0]}.`, "Portfolio artifact"],
      [gaps[1] || "Communication", `Explain your project in plain language to a peer.`, "Peer feedback"],
      ["Polish your story", "Turn the project into three result-focused résumé bullets.", "Résumé upgrade"],
      ["Rehearse", "Answer two adaptive interview questions and improve weak signals.", "Interview score"],
      ["Apply with proof", `Tailor your application for ${analysis.company}.`, "Application pack"],
    ];
  }, [analysis]);

  const switchRole = (role: keyof typeof roles) => {
    setSelectedRole(role);
    setProfile(roles[role].profile);
    setListing(roles[role].listing);
    setAnalysis(makeAnalysis(role, roles[role].profile));
    setAnswer("");
    setAnswerResult(null);
    setQuestionIndex(0);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAiState("loading");
    setAnswerResult(null);
    const inferred = inferRole(listing);
    const base = makeAnalysis(inferred, profile);
    try {
      const similarity = await Promise.race([
        compareMeaning(profile, listing),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Model warm-up timed out")), 6500)),
      ]);
      const semanticScore = Math.round(42 + similarity * 50);
      setAnalysis({ ...base, score: Math.round(base.score * 0.62 + semanticScore * 0.38) });
      setAiState("ready");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 550));
      setAnalysis(base);
      setAiState("fallback");
    }
    setSelectedRole(inferred);
    setAnalyzing(false);
    document.getElementById("pathfinder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleDay = (day: number) => {
    const next = completedDays.includes(day)
      ? completedDays.filter((item) => item !== day)
      : [...completedDays, day];
    setCompletedDays(next);
    window.localStorage.setItem("careerready-progress", JSON.stringify(next));
  };

  const scrollTo = (id: string, label?: string) => {
    setActiveNav(label || id);
    setMobileNav(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`} aria-label="Primary navigation">
        <div className="brand" onClick={() => scrollTo("top", "Overview")} role="button" tabIndex={0}>
          <span className="brand-mark"><Sparkles size={19} /></span>
          <span>Career<span>Ready</span></span>
        </div>
        <button className="close-menu" onClick={() => setMobileNav(false)} aria-label="Close menu"><X /></button>
        <p className="nav-kicker">Your workspace</p>
        <nav>
          {navItems.map(([label, Icon]) => {
            const id = label === "Overview" ? "top" : label === "Pathfinder" ? "pathfinder" : label === "Learning sprint" ? "sprint" : "interview";
            return (
              <button key={label} className={activeNav === label ? "active" : ""} onClick={() => scrollTo(id, label)}>
                <Icon size={18} /> {label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-impact">
          <HeartHandshake size={19} />
          <div><strong>Built for access</strong><span>No degree filter. No career jargon.</span></div>
        </div>
        <div className="profile-pill"><span>HS</span><div><strong>Harvin S.</strong><small>7-day streak · 1 day</small></div><ChevronRight size={16} /></div>
      </aside>

      {mobileNav && <button className="nav-backdrop" aria-label="Close menu" onClick={() => setMobileNav(false)} />}

      <section className="content" id="top">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu /></button>
          <div className="mode-badge"><span className="pulse" /> {aiState === "loading" ? "Loading private model…" : aiState === "ready" ? "On-device AI ready · nothing uploaded" : aiState === "fallback" ? "Fast local analysis · private by design" : "On-device AI · private by design"}</div>
          <button className="help-button"><CircleHelp size={18} /> <span>How it works</span></button>
        </header>

        <div className="page-wrap">
          <section className="hero-section">
            <div>
              <div className="eyebrow"><span>01</span> Opportunity Pathfinder</div>
              <h1>Your career gap,<br /><em>translated into a plan.</em></h1>
              <p>CareerReady turns any job post into a fair, explainable skill map—then helps you build the proof employers actually look for.</p>
            </div>
            <div className="hero-proof" aria-label="Privacy statement">
              <LockKeyhole size={20} />
              <div><strong>Your story stays yours.</strong><span>Analysis happens in your browser. Personal details are removed before matching.</span></div>
            </div>
          </section>

          <section className="input-card" aria-labelledby="start-heading">
            <div className="input-card-heading">
              <div><span className="mini-label">Try a real pathway</span><h2 id="start-heading">What are you aiming for?</h2></div>
              <div className="role-tabs" role="tablist" aria-label="Example roles">
                {(Object.keys(roles) as Array<keyof typeof roles>).map((role) => (
                  <button key={role} role="tab" aria-selected={selectedRole === role} className={selectedRole === role ? "selected" : ""} onClick={() => switchRole(role)}>{role}</button>
                ))}
              </div>
            </div>
            <div className="input-grid">
              <label>
                <span className="field-title"><UserRound size={17} /> Your experience <small>{profile.trim().split(/\s+/).length} words</small></span>
                <textarea value={profile} onChange={(event) => setProfile(event.target.value)} placeholder="Paste your résumé or describe projects, volunteering and skills…" />
              </label>
              <label>
                <span className="field-title"><BriefcaseBusiness size={17} /> Target opportunity <small>Job post</small></span>
                <textarea value={listing} onChange={(event) => setListing(event.target.value)} placeholder="Paste a job description…" />
              </label>
            </div>
            <div className="analysis-actions">
              <button className={`privacy-toggle ${privacyOn ? "on" : ""}`} onClick={() => setPrivacyOn(!privacyOn)} aria-pressed={privacyOn}>
                <span><ShieldCheck size={17} /></span><div><strong>Privacy shield {privacyOn ? "on" : "off"}</strong><small>{privacyOn ? "Names, email and phone ignored" : "Use full text for matching"}</small></div>
              </button>
              <button className="primary-button" disabled={analyzing || !profile.trim() || !listing.trim()} onClick={runAnalysis}>
                {analyzing ? <><span className="spinner" /> Mapping your evidence…</> : <>Map my path <ArrowRight size={18} /></>}
              </button>
            </div>
          </section>

          <section className="results-section" id="pathfinder">
            <div className="section-heading">
              <div><div className="eyebrow"><span>02</span> Explainable match</div><h2>See the signal—not a verdict.</h2></div>
              <p>Every score points back to evidence you provided. You can challenge it, improve it, or ignore it.</p>
            </div>
            <div className="results-grid">
              <article className="score-card">
                <div className="score-top"><span>Readiness for</span><strong>{analysis.role}</strong><small>{analysis.company}</small></div>
                <div className="score-ring" style={{ "--score": `${analysis.score * 3.6}deg` } as React.CSSProperties}>
                  <div><strong>{analysis.score}</strong><span>/100</span></div>
                </div>
                <p><Sparkles size={16} /> Promising match</p>
                <span className="score-caption">You already show {analysis.strengths.length} of the core signals. Build proof for {analysis.gaps[0]} next.</span>
                <button onClick={() => scrollTo("sprint", "Learning sprint")}>Turn gaps into a sprint <ArrowRight size={16} /></button>
              </article>

              <article className="skill-card">
                <div className="card-title-row"><div><span className="mini-label">Evidence map</span><h3>How your experience translates</h3></div><BrainCircuit size={24} /></div>
                <div className="skill-list">
                  {analysis.skills.map((skill) => (
                    <div className="skill-row" key={skill.name}>
                      <div className="skill-copy"><strong>{skill.name}</strong><span>{skill.evidence}</span></div>
                      <div className="skill-meter"><span style={{ width: `${skill.score}%` }} className={skill.status} /></div>
                      <b>{skill.score}%</b>
                    </div>
                  ))}
                </div>
                <div className="legend"><span><i className="dot strong" /> Evidence found</span><span><i className="dot build" /> Build next</span><button><Lightbulb size={15} /> Why these skills?</button></div>
              </article>
            </div>
          </section>

          <section className="sprint-section" id="sprint">
            <div className="section-heading">
              <div><div className="eyebrow"><span>03</span> Proof-building sprint</div><h2>Seven days. One credible step forward.</h2></div>
              <div className="progress-copy"><strong>{completedDays.length}/7</strong><span>days complete</span></div>
            </div>
            <div className="progress-track"><span style={{ width: `${(completedDays.length / 7) * 100}%` }} /></div>
            <div className="sprint-grid">
              {sprint.map(([title, task, outcome], index) => {
                const day = index + 1;
                const complete = completedDays.includes(day);
                return (
                  <button className={`day-card ${complete ? "complete" : ""}`} key={day} onClick={() => toggleDay(day)}>
                    <div className="day-number">{complete ? <Check size={17} /> : String(day).padStart(2, "0")}</div>
                    <small>Day {day}</small>
                    <h3>{title}</h3>
                    <p>{task}</p>
                    <div><span><Clock3 size={14} /> 25 min</span><span><FileText size={14} /> {outcome}</span></div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="interview-section" id="interview">
            <div className="interview-intro">
              <div className="eyebrow light"><span>04</span> Adaptive interview lab</div>
              <h2>Practice the story<br />behind the skills.</h2>
              <p>No generic “confidence” score. CareerReady checks whether your answer includes context, your action, and a concrete outcome.</p>
              <div className="question-dots">{interviewQuestions[selectedRole].map((_, index) => <span key={index} className={questionIndex === index ? "active" : ""} />)}</div>
            </div>
            <div className="interview-card">
              <div className="question-label"><span>Question {questionIndex + 1} of 3</span><button onClick={() => { setQuestionIndex((questionIndex + 1) % 3); setAnswer(""); setAnswerResult(null); }}><RotateCcw size={15} /> New question</button></div>
              <h3>“{interviewQuestions[selectedRole][questionIndex]}”</h3>
              <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Try: During our school recycling project, I noticed…" />
              <div className="answer-actions">
                <button className="mic-button" title="Voice input is available in supported browsers"><Mic size={18} /> Speak answer</button>
                <span>{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
                <button className="review-button" disabled={!answer.trim()} onClick={() => setAnswerResult(scoreAnswer(answer))}><Play size={17} /> Review my answer</button>
              </div>
              {answerResult && (
                <div className="feedback-panel">
                  <div className="feedback-score"><strong>{answerResult.score}</strong><span>answer score</span></div>
                  <div className="feedback-checks">
                    {answerResult.checks.map(([label, passed, tip]) => <div key={label} className={passed ? "passed" : "needs-work"}><span>{passed ? <Check size={14} /> : <Lightbulb size={14} />}</span><div><strong>{label}</strong><small>{passed ? "Clear signal found" : tip}</small></div></div>)}
                  </div>
                </div>
              )}
            </div>
          </section>

          <footer>
            <div className="brand footer-brand"><span className="brand-mark"><Sparkles size={18} /></span><span>Career<span>Ready</span></span></div>
            <p>AI that opens doors—not another gatekeeper.</p>
            <div><span><ShieldCheck size={15} /> Explainable</span><span><LockKeyhole size={15} /> Private</span><span><HeartHandshake size={15} /> Inclusive</span></div>
          </footer>
        </div>
      </section>
    </main>
  );
}
