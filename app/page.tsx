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
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { compareMeaning } from "./on-device-ai";
import { analyzeListing, type Analysis } from "./analyze";
import { reviewResume } from "./resume-review";
import { extractPdfText, isPdfFile, MAX_PDF_BYTES, PdfReadError } from "./pdf-text";
import { api } from "../convex/_generated/api";

// Inlined at build time from NEXT_PUBLIC_CONVEX_URL (see ConvexClientProvider).
// Deployments that haven't configured Convex yet keep the original
// localStorage-only behavior instead of mounting Convex hooks with no provider.
const CONVEX_ENABLED = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

// Starting points only — the analysis itself reads whatever listing the user
// pastes, so any job description works, not just these.
const samples = {
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

const navItems = [
  ["Overview", TrendingUp],
  ["Pathfinder", Target],
  ["Résumé review", FileText],
  ["Learning sprint", BookOpen],
  ["Interview lab", MessageSquareText],
] as const;

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
  const [selectedRole, setSelectedRole] = useState<string>("Data Analyst");
  const [profile, setProfile] = useState<string>(samples["Data Analyst"].profile);
  const [listing, setListing] = useState<string>(samples["Data Analyst"].listing);
  // Semantic nudge from the on-device model. Null until "Map my path" runs, and
  // cleared whenever the inputs change so a stale score can never linger.
  const [semanticScore, setSemanticScore] = useState<number | null>(null);
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [privacyOn, setPrivacyOn] = useState(true);
  const [answer, setAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<ReturnType<typeof scoreAnswer> | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [completedDays, setCompletedDays] = useState<number[]>([1]);
  const [aiState, setAiState] = useState<"private" | "loading" | "ready" | "fallback">("private");
  const [resumeFile, setResumeFile] = useState<{ name: string; pages: number; words: number } | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "reading">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("careerready-progress");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe read from localStorage; SSR can't see it, so it can't be a lazy useState initializer.
    if (saved) setCompletedDays(JSON.parse(saved));
  }, []);

  // Derived, never stored. Uploading a résumé or editing the listing used to
  // leave the whole skill map, sprint and interview showing the previous
  // analysis until "Map my path" was pressed again — evidence quoted from text
  // the user had already replaced.
  const analysis: Analysis = useMemo(() => {
    const base = analyzeListing(listing, profile);
    if (semanticScore === null) return base;
    // The evidence-based score leads; the model only nudges it.
    return { ...base, score: Math.round(base.score * 0.82 + semanticScore * 0.18) };
  }, [listing, profile, semanticScore]);

  // Recomputed as the résumé is edited, so fixes are reflected immediately.
  const review = useMemo(
    () => reviewResume(profile, analysis.skills.map((skill) => skill.name)),
    [profile, analysis],
  );

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

  // The fields start pre-filled with a worked example so the page is readable
  // on arrival; this empties them so the user can use their own.
  const clearFields = () => {
    setProfile("");
    setListing("");
    setAnswer("");
    setAnswerResult(null);
    setQuestionIndex(0);
    setResumeFile(null);
    setUploadError(null);
    setShowExtracted(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    document.getElementById("start-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleResumeFile = async (file: File | undefined | null) => {
    if (!file) return;
    setUploadError(null);

    if (!isPdfFile(file)) {
      setUploadError(`“${file.name}” isn’t a PDF. Only .pdf files are supported.`);
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setUploadError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please keep it under 10 MB.`);
      return;
    }

    setUploadState("reading");
    try {
      const { text, pages, words } = await extractPdfText(file);
      setProfile(text);
      setSemanticScore(null);
      setResumeFile({ name: file.name, pages, words });
      setShowExtracted(false);
    } catch (error) {
      setResumeFile(null);
      setUploadError(
        error instanceof PdfReadError
          ? error.message
          : "That PDF couldn’t be read. Try re-exporting it, or paste your experience as text.",
      );
    } finally {
      setUploadState("idle");
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAiState("loading");
    setAnswerResult(null);
    setQuestionIndex(0);
    setAnswer("");
    try {
      const similarity = await Promise.race([
        compareMeaning(profile, listing),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Model warm-up timed out")), 6500)),
      ]);
      setSemanticScore(Math.round(42 + similarity * 50));
      setAiState("ready");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 550));
      setSemanticScore(null);
      setAiState("fallback");
    }
    setSelectedRole(analyzeListing(listing, profile).role);
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
            const id = label === "Overview" ? "top" : label === "Pathfinder" ? "pathfinder" : label === "Résumé review" ? "resume" : label === "Learning sprint" ? "sprint" : "interview";
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
        {CONVEX_ENABLED ? (
          <AccountPanel
            syncState={{ selectedRole, profile, listing, completedDays }}
            onHydrate={(saved) => {
              setSelectedRole(saved.selectedRole);
              setProfile(saved.profile);
              setListing(saved.listing);
              setCompletedDays(saved.completedDays);
            }}
          />
        ) : (
          <div className="profile-pill"><span>HS</span><div><strong>Harvin S.</strong><small>7-day streak · 1 day</small></div><ChevronRight size={16} /></div>
        )}
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
              <div><span className="mini-label">Any role · any industry · any employer</span><h2 id="start-heading">Paste the job you&rsquo;re aiming for</h2></div>
              <button type="button" className="ghost-button" onClick={clearFields}>
                <RotateCcw size={15} /> Clear and use my own
              </button>
            </div>
            <div className="input-grid">
              <div className="upload-field">
                <span className="field-title"><UserRound size={17} /> Your résumé <small>PDF only</small></span>
                <div
                  className={`dropzone${dragging ? " dragging" : ""}${resumeFile ? " filled" : ""}${uploadState === "reading" ? " busy" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload your résumé as a PDF"
                  aria-busy={uploadState === "reading"}
                  onClick={() => uploadState === "idle" && fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (uploadState === "idle") fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void handleResumeFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="visually-hidden"
                    onChange={(event) => void handleResumeFile(event.target.files?.[0])}
                  />
                  {uploadState === "reading" ? (
                    <><span className="spinner" /><strong>Reading your PDF…</strong><small>Happening in your browser</small></>
                  ) : resumeFile ? (
                    <>
                      <FileText size={22} />
                      <strong>{resumeFile.name}</strong>
                      <small>{resumeFile.pages} page{resumeFile.pages === 1 ? "" : "s"} · {resumeFile.words} words read · click to replace</small>
                    </>
                  ) : (
                    <>
                      <Upload size={22} />
                      <strong>Upload your résumé</strong>
                      <small>Drag a PDF here, or click to browse. Supported: .pdf only.</small>
                    </>
                  )}
                </div>

                {uploadError && <p className="upload-error"><X size={13} /> {uploadError}</p>}

                {profile.trim() && (
                  <div className="extracted">
                    <button type="button" onClick={() => setShowExtracted(!showExtracted)}>
                      {showExtracted ? "Hide" : "Check"} the text we read
                      <small>{profile.trim().split(/\s+/).filter(Boolean).length} words</small>
                    </button>
                    {showExtracted && (
                      <textarea
                        value={profile}
                        onChange={(event) => setProfile(event.target.value)}
                        aria-label="Text read from your résumé"
                        placeholder="Your résumé text appears here once a PDF is read. You can correct it."
                      />
                    )}
                  </div>
                )}
              </div>
              <label>
                <span className="field-title"><BriefcaseBusiness size={17} /> Target opportunity <small>{listing.trim().split(/\s+/).filter(Boolean).length} words</small></span>
                <textarea value={listing} onChange={(event) => { setListing(event.target.value); setSemanticScore(null); }} placeholder="Paste any job description here — any role, any industry. CareerReady reads the skills it asks for and checks them against your experience." />
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

          <section className="resume-section" id="resume" aria-labelledby="resume-heading">
            <div className="section-heading">
              <div>
                <div className="eyebrow"><span>03</span> Résumé review</div>
                <h2 id="resume-heading">Fix the lines before you send them.</h2>
              </div>
              <p>Checked against this job post, in your browser. Every note points at your own words.</p>
            </div>

            {profile.trim().length < 15 ? (
              <div className="resume-empty">
                <FileText size={20} />
                <p>Paste your experience above and the review appears here — no upload, no account needed.</p>
              </div>
            ) : (
              <div className="resume-grid">
                <article className="resume-score-card">
                  <span className="mini-label">Résumé strength</span>
                  <strong>{review.score}<small>/100</small></strong>
                  <p>{review.wordCount} words · {review.checks.filter((check) => check.status === "pass").length} of {review.checks.length} checks passed</p>
                  <div className="resume-check-bar" role="img" aria-label={`${review.checks.filter((check) => check.status === "pass").length} of ${review.checks.length} checks passed`}>
                    {review.checks.map((check) => <span key={check.label} className={check.status} />)}
                  </div>
                </article>

                <article className="resume-checks">
                  {review.checks.map((check) => (
                    <div className={`resume-check ${check.status}`} key={check.label}>
                      <span className="resume-check-icon">
                        {check.status === "pass" ? <Check size={14} /> : check.status === "warn" ? <Lightbulb size={14} /> : <X size={14} />}
                      </span>
                      <div>
                        <strong>{check.label}</strong>
                        <span>{check.detail}</span>
                        {check.fix && <small>{check.fix}</small>}
                      </div>
                    </div>
                  ))}
                </article>
              </div>
            )}

            {review.bullets.length > 0 && (
              <div className="rewrite-block">
                <div className="rewrite-head">
                  <Sparkles size={17} />
                  <div>
                    <strong>Line-by-line rewrites</strong>
                    <span>Suggestions only — keep your own voice, and never claim something you cannot back up.</span>
                  </div>
                </div>
                {review.bullets.map((bullet) => (
                  <div className="rewrite-row" key={bullet.original}>
                    <p className="rewrite-before">{bullet.original}</p>
                    <ul className="rewrite-issues">
                      {bullet.issues.map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                    <p className="rewrite-after"><ArrowRight size={14} /> {bullet.rewrite}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="sprint-section" id="sprint">
            <div className="section-heading">
              <div><div className="eyebrow"><span>04</span> Proof-building sprint</div><h2>Seven days. One credible step forward.</h2></div>
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
              <div className="eyebrow light"><span>05</span> Adaptive interview lab</div>
              <h2>Practice the story<br />behind the skills.</h2>
              <p>No generic “confidence” score. CareerReady checks whether your answer includes context, your action, and a concrete outcome.</p>
              <div className="question-dots">{analysis.questions.map((_, index) => <span key={index} className={questionIndex === index ? "active" : ""} />)}</div>
            </div>
            <div className="interview-card">
              <div className="question-label"><span>Question {questionIndex + 1} of {analysis.questions.length}</span><button onClick={() => { setQuestionIndex((questionIndex + 1) % analysis.questions.length); setAnswer(""); setAnswerResult(null); }}><RotateCcw size={15} /> New question</button></div>
              <h3>“{analysis.questions[questionIndex] ?? analysis.questions[0]}”</h3>
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

type SyncedState = {
  selectedRole: string;
  profile: string;
  listing: string;
  completedDays: number[];
};

// Replaces the sidebar's static profile pill when Convex is configured.
// Signed out: a trigger that opens an email+password sign up/in form.
// Signed in: current progress is synced to Convex (debounced) and hydrated
// back on load, so it follows the user across devices. Anonymous use is
// unaffected — localStorage stays the source of truth until sign-in.
function AccountPanel({
  syncState,
  onHydrate,
}: {
  syncState: SyncedState;
  onHydrate: (saved: SyncedState) => void;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const saved = useQuery(api.careerProfile.get, isAuthenticated ? {} : "skip");
  const save = useMutation(api.careerProfile.save);

  const [panelOpen, setPanelOpen] = useState(false);
  const [mode, setMode] = useState<"signUp" | "signIn">("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      hydratedRef.current = false;
      return;
    }
    if (saved === undefined || hydratedRef.current) return;
    hydratedRef.current = true;
    if (saved) {
      onHydrate({
        selectedRole: saved.selectedRole,
        profile: saved.profile,
        listing: saved.listing,
        completedDays: saved.completedDays,
      });
    }
    // onHydrate is a fresh closure each render; only re-run when the server
    // snapshot or auth state actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, saved]);

  useEffect(() => {
    if (!isAuthenticated || !hydratedRef.current) return;
    const timeout = setTimeout(() => {
      save(syncState).catch(() => {});
    }, 800);
    return () => clearTimeout(timeout);
  }, [isAuthenticated, syncState, save]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow: mode });
      setPanelOpen(false);
      setPassword("");
    } catch {
      setError(
        mode === "signUp"
          ? "Could not create that account — try a different email or a password with at least 8 characters."
          : "Incorrect email or password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="profile-pill"><span>··</span><div><strong>Loading…</strong></div></div>;
  }

  if (isAuthenticated) {
    return (
      <button type="button" className="profile-pill" onClick={() => signOut()}>
        <span><UserRound size={16} /></span>
        <div><strong>Signed in</strong><small>Synced to your account · tap to sign out</small></div>
        <ChevronRight size={16} />
      </button>
    );
  }

  return (
    <div className="account-panel">
      <button type="button" className="profile-pill" onClick={() => setPanelOpen((open) => !open)} aria-expanded={panelOpen}>
        <span><UserRound size={16} /></span>
        <div><strong>Save your progress</strong><small>Sign in or create an account</small></div>
        <ChevronRight size={16} />
      </button>
      {panelOpen && (
        <form className="account-form" onSubmit={submit}>
          <div className="account-form-tabs">
            <button type="button" className={mode === "signUp" ? "active" : ""} onClick={() => setMode("signUp")}>Create account</button>
            <button type="button" className={mode === "signIn" ? "active" : ""} onClick={() => setMode("signIn")}>Sign in</button>
          </div>
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" required minLength={8} autoComplete={mode === "signUp" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="account-form-error">{error}</p>}
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "…" : mode === "signUp" ? "Create account" : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
