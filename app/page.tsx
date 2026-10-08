import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Public landing page. Signed-in visitors skip straight to their dashboard;
// everyone else sees the Why/What-before-How pitch and the data model, with
// every CTA pointing at /login (there's no separate public sign-up today —
// access is by invite, see lib/workspaces.ts).
export const metadata = {
  title: "Loom — map the Why and What before the How",
  description:
    "Loom maps the Why and What of a business process before anyone reaches for an innovation technique. See how Workspace, Process, Lane, Step, Line and Role fit together.",
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
      />
      <style>{`
        .lp *{box-sizing:border-box}
        .lp{
          --bg:#0a1119; --panel:#111c28; --fg:#e6edf3; --muted:#93a5b6;
          --border:rgba(255,255,255,0.1); --accent:#f8991d; --accent-ink:#1a1206; --wire:#d9b74a; --info:#7fa8ff; --rework:#f87171;
          background:var(--bg); color:var(--fg);
          font-family:"Poppins",-apple-system,Segoe UI,sans-serif;
          line-height:1.55;
        }
        .lp .wrap{max-width:1040px; margin:0 auto; padding-inline:clamp(16px,5vw,32px)}
        .lp h1,.lp h2,.lp h3{font-family:"Poppins",sans-serif; font-weight:700; text-wrap:balance; margin:0}
        .lp p{margin:0}
        .lp a{color:var(--accent)}
        .lp img,.lp svg{max-width:100%}

        .lp header.nav{
          position:sticky; top:0; z-index:20;
          background:rgba(10,17,25,0.88);
          backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
          border-bottom:1px solid var(--border);
        }
        .lp .nav-row{display:flex; align-items:center; justify-content:space-between; gap:16px; padding-block:14px}
        .lp .brand{display:flex; align-items:center; gap:10px; font-weight:700; font-size:1.05rem}
        .lp .brand .mark{width:26px; height:26px; flex:none}
        .lp .nav-links{display:flex; gap:22px; font-size:.92rem; color:var(--muted)}
        .lp .nav-links a{color:inherit; text-decoration:none}
        .lp .nav-links a:hover{color:var(--fg)}
        .lp .cta-btn{
          display:inline-flex; align-items:center; gap:8px; padding:.6em 1.1em; border-radius:999px;
          background:var(--accent); color:var(--accent-ink); font-weight:600; font-size:.88rem; text-decoration:none;
          white-space:nowrap;
        }
        .lp .cta-btn.ghost{background:transparent; border:1px solid var(--border); color:var(--fg)}
        @media (max-width:640px){ .lp .nav-links{display:none} }

        .lp .hero{position:relative; padding-block:clamp(48px,9vw,96px) clamp(40px,7vw,64px); overflow:hidden}
        .lp .hero-glow{position:absolute; inset:-20% -10% auto -10%; height:120%; z-index:0; pointer-events:none; opacity:.55;
          background:
            radial-gradient(38vw 38vw at 12% 10%, rgba(248,153,29,0.30), transparent 60%),
            radial-gradient(42vw 42vw at 92% 0%, rgba(127,168,255,0.24), transparent 60%);
        }
        .lp .hero-inner{position:relative; z-index:1; display:grid; gap:18px; max-width:700px}
        .lp .eyebrow{font-size:.78rem; letter-spacing:.14em; text-transform:uppercase; color:var(--wire); font-weight:600}
        .lp h1.headline{font-size:clamp(2rem,5.4vw,3.3rem); line-height:1.08}
        .lp h1.headline em{color:var(--accent); font-style:normal}
        .lp .sub{font-size:1.08rem; color:var(--muted); max-width:46ch}
        .lp .hero-ctas{display:flex; gap:12px; flex-wrap:wrap; margin-top:6px}

        .lp section{padding-block:clamp(40px,7vw,72px); border-top:1px solid var(--border)}
        .lp .kicker{font-size:.78rem; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); font-weight:600; margin-bottom:10px}
        .lp h2.section-title{font-size:clamp(1.5rem,3.2vw,2.1rem); margin-bottom:14px}
        .lp .lede{color:var(--muted); font-size:1.02rem; max-width:62ch; margin-bottom:8px}

        .lp .two-col{display:grid; grid-template-columns:1fr 1fr; gap:40px; align-items:start}
        @media (max-width:760px){ .lp .two-col{grid-template-columns:1fr} }

        .lp figure.diagram{margin:28px 0 8px; min-width:0}
        .lp figure.diagram svg{width:100%; display:block; background:var(--panel); border:1px solid var(--border); border-radius:16px}
        .lp figcaption{color:var(--muted); font-size:.86rem; margin-top:10px; max-width:70ch}

        .lp .term-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:24px}
        @media (max-width:760px){ .lp .term-grid{grid-template-columns:1fr 1fr} }
        @media (max-width:460px){ .lp .term-grid{grid-template-columns:1fr} }
        .lp .term{
          background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:16px;
          display:flex; flex-direction:column; gap:8px; min-width:0;
        }
        .lp .term .glyph{width:30px; height:30px; flex:none}
        .lp .term h3{font-size:.98rem}
        .lp .term p{font-size:.86rem; color:var(--muted)}
        .lp .term .rel{font-size:.74rem; color:var(--wire); font-weight:600; letter-spacing:.02em}

        .lp .flow-strip{display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:4px; font-size:.86rem; color:var(--muted)}
        .lp .flow-strip .node{padding:.35em .8em; border:1px solid var(--border); border-radius:999px; background:var(--panel); color:var(--fg); font-weight:600; white-space:nowrap}
        .lp .flow-strip .arrow{color:var(--wire); font-weight:700}

        .lp .closer{display:grid; gap:14px; text-align:left}
        .lp .closer .lede{margin-bottom:0}

        .lp footer{border-top:1px solid var(--border); padding-block:28px}
        .lp .foot-row{display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; font-size:.82rem; color:var(--muted)}
        .lp .foot-row a{color:var(--muted); text-decoration:none}
        .lp .foot-row a:hover{color:var(--fg)}
      `}</style>

      <div className="lp">
        <header className="nav">
          <div className="wrap nav-row">
            <div className="brand">
              <svg className="mark" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r="22" fill="none" stroke="var(--wire)" strokeWidth="2.5" />
                <circle cx="24" cy="24" r="4" fill="var(--accent)" />
                <circle cx="12" cy="14" r="3" fill="var(--info)" />
                <circle cx="37" cy="16" r="3" fill="var(--wire)" />
                <circle cx="14" cy="35" r="3" fill="var(--rework)" />
                <line x1="24" y1="24" x2="12" y2="14" stroke="var(--wire)" strokeWidth="1.6" />
                <line x1="24" y1="24" x2="37" y2="16" stroke="var(--wire)" strokeWidth="1.6" />
                <line x1="24" y1="24" x2="14" y2="35" stroke="var(--wire)" strokeWidth="1.6" />
              </svg>
              Loom
            </div>
            <nav className="nav-links">
              <a href="#model">Data model</a>
              <a href="#terms">Vocabulary</a>
              <a href="#how">Then the How</a>
            </nav>
            <a className="cta-btn" href="/login">
              Log in ↗
            </a>
          </div>
        </header>

        <main>
          <section className="hero" style={{ borderTop: "none" }}>
            <div className="hero-glow" aria-hidden="true"></div>
            <div className="wrap hero-inner">
              <span className="eyebrow">Before the How</span>
              <h1 className="headline">
                Agree on the <em>Why</em> and the <em>What</em>.<br />
                Then go looking for the How.
              </h1>
              <p className="sub">
                Most teams reach for an innovation — automation, AI, a new tool — before they&rsquo;ve agreed on what&rsquo;s
                actually happening and why it hurts. Loom is where you map the real process first, so the fix that
                follows actually fixes something.
              </p>
              <div className="hero-ctas">
                <a className="cta-btn" href="/login">
                  Log in
                </a>
                <a className="cta-btn ghost" href="#model">
                  See the data model ↓
                </a>
              </div>
            </div>
          </section>

          <section id="why-what">
            <div className="wrap two-col">
              <div>
                <div className="kicker">The order matters</div>
                <h2 className="section-title">The How is the easy part to get excited about.</h2>
                <p className="lede">
                  It&rsquo;s also the part that fails silently when it&rsquo;s aimed at the wrong step. An AI agent
                  bolted onto a process nobody&rsquo;s mapped just moves the bottleneck — it doesn&rsquo;t remove it.
                </p>
              </div>
              <div>
                <p className="lede">
                  Loom holds the line on sequence: lay out the process as it actually runs today — who touches it,
                  where it waits, where it breaks — before anyone picks a technique to fix it. That ordering is the
                  whole product.
                </p>
                <div className="flow-strip" aria-hidden="true">
                  <span className="node" style={{ borderColor: "var(--wire)", color: "var(--wire)" }}>
                    Why
                  </span>
                  <span className="arrow">→</span>
                  <span className="node" style={{ borderColor: "var(--info)", color: "var(--info)" }}>
                    What
                  </span>
                  <span className="arrow">→</span>
                  <span className="node" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                    How
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section id="model">
            <div className="wrap">
              <div className="kicker">The data model</div>
              <h2 className="section-title">One company, many problems worth mapping.</h2>
              <p className="lede">
                Loom&rsquo;s shape follows how the work actually nests: a company&rsquo;s <strong>Workspace</strong> holds
                every process worth examining, each <strong>Process</strong> is mapped in <strong>Lanes</strong>,
                each Lane is a row of <strong>Steps</strong> joined by <strong>Lines</strong>, and every Step has a{" "}
                <strong>Role</strong> — the person, team, system or AI actually doing it today.
              </p>

              <figure className="diagram">
                <svg viewBox="0 0 900 450" role="img" aria-label="A mapped process in Loom: four lanes (Customer, Sales, Finance, Fulfilment) hold steps drawn in role shapes, joined by lines of different weight. One handoff shows a three-day wait, one step carries two comments, and a dashed red line loops back for rework.">
<defs>
<marker id="arr-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9 z" fill="#d9b74a" /></marker>
<marker id="arr-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9 z" fill="#f87171" /></marker>
</defs>
<g fontSize="11" fontFamily="IBM Plex Mono, monospace">
<rect x="20" y="14" width="74" height="26" rx="13" fill="none" stroke="#f8991d" strokeOpacity="0.6" />
<text x="57" y="31" textAnchor="middle" fill="#f8991d">+ STEP</text>
<circle cx="112" cy="27" r="13" fill="none" stroke="currentColor" strokeOpacity="0.25" /><text x="112" y="31" textAnchor="middle" fill="currentColor" opacity="0.7">↶</text>
<circle cx="142" cy="27" r="13" fill="none" stroke="currentColor" strokeOpacity="0.25" /><text x="142" y="31" textAnchor="middle" fill="currentColor" opacity="0.7">↷</text>
<rect x="164" y="14" width="150" height="26" rx="13" fill="none" stroke="currentColor" strokeOpacity="0.25" />
<circle cx="182" cy="26" r="4.5" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.4" /><path d="M185.5 29.5 L189 33" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" />
<text x="198" y="31" fill="currentColor" opacity="0.5">Find a step…</text>
</g>
<text x="880" y="31" textAnchor="end" fontSize="13" fontWeight="600" fill="currentColor" opacity="0.85">Order to delivery <tspan fontWeight="400" opacity="0.5" fontSize="11"> · Process</tspan></text>
<rect x="20" y="58" width="860" height="82" rx="10" fill="#ffffff" fillOpacity="0.025" stroke="currentColor" strokeOpacity="0.12" />
<rect x="20" y="58" width="4" height="82" rx="2" fill="#f87171" fillOpacity="0.8" />
<text x="34" y="73" fontSize="11" fill="currentColor" opacity="0.6">Customer</text>
<rect x="20" y="146" width="860" height="82" rx="10" fill="#ffffff" fillOpacity="0.025" stroke="currentColor" strokeOpacity="0.12" />
<rect x="20" y="146" width="4" height="82" rx="2" fill="#f8991d" fillOpacity="0.8" />
<text x="34" y="161" fontSize="11" fill="currentColor" opacity="0.6">Sales</text>
<rect x="20" y="234" width="860" height="82" rx="10" fill="#ffffff" fillOpacity="0.025" stroke="currentColor" strokeOpacity="0.12" />
<rect x="20" y="234" width="4" height="82" rx="2" fill="#7fa8ff" fillOpacity="0.8" />
<text x="34" y="249" fontSize="11" fill="currentColor" opacity="0.6">Finance</text>
<rect x="20" y="322" width="860" height="82" rx="10" fill="#ffffff" fillOpacity="0.025" stroke="currentColor" strokeOpacity="0.12" />
<rect x="20" y="322" width="4" height="82" rx="2" fill="#d9b74a" fillOpacity="0.8" />
<text x="34" y="337" fontSize="11" fill="currentColor" opacity="0.6">Fulfilment</text>
<path d="M220 100.0 C235.0 100.0 235.0 188.0 250 188.0" fill="none" stroke="#d9b74a" strokeWidth="5" strokeLinecap="round" markerEnd="url(#arr-g)" />
<path d="M370 188.0 C385.0 188.0 385.0 276.0 400 276.0" fill="none" stroke="#d9b74a" strokeWidth="5" strokeLinecap="round" markerEnd="url(#arr-g)" />
<path d="M520 276.0 C535.0 276.0 535.0 364.0 550 364.0" fill="none" stroke="#d9b74a" strokeWidth="2.6" strokeLinecap="round" markerEnd="url(#arr-g)" />
<path d="M520 276.0 C540.0 276.0 540.0 188.0 560 188.0" fill="none" stroke="#d9b74a" strokeWidth="1.4" strokeLinecap="round" markerEnd="url(#arr-g)" />
<path d="M670 364.0 C685.0 364.0 685.0 364.0 700 364.0" fill="none" stroke="#d9b74a" strokeWidth="5" strokeLinecap="round" markerEnd="url(#arr-g)" />
<path d="M760.0 342 C760.0 232.0 800.0 232.0 800.0 122" fill="none" stroke="#d9b74a" strokeWidth="2.6" strokeLinecap="round" markerEnd="url(#arr-g)" />
<path d="M610 386 C610 440 310 440 310 210" fill="none" stroke="#f87171" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" markerEnd="url(#arr-r)" />
<text x="455" y="432" textAnchor="middle" fontSize="10.5" fill="#f87171" opacity="0.9">rework</text>
<g><rect x="346" y="233" width="78" height="22" rx="11" fill="#3b1d1d" stroke="#f87171" strokeOpacity="0.8" /><text x="385" y="248" textAnchor="middle" fontSize="10.5" fill="#fca5a5">waits 3 days</text></g>
<polygon points="114,78 220,78 206,122 100,122" fill="#16212f" stroke="#f87171" strokeWidth="1.8" />
<text x="160.0" y="104.0" textAnchor="middle" fontSize="11.5" fill="#e6edf3">Places order</text>
<rect x="250" y="166" width="120" height="44" rx="22" fill="#16212f" stroke="#f8991d" strokeWidth="1.8" />
<text x="310.0" y="192.0" textAnchor="middle" fontSize="11.5" fill="#e6edf3">Confirm order</text>
<rect x="400" y="254" width="120" height="44" rx="2" fill="#16212f" stroke="#d9b74a" strokeWidth="1.8" />
<text x="460.0" y="280.0" textAnchor="middle" fontSize="11.5" fill="#e6edf3">Credit check</text>
<rect x="550" y="342" width="120" height="44" rx="10" fill="#16212f" stroke="#7fa8ff" strokeWidth="1.8" />
<text x="610.0" y="368.0" textAnchor="middle" fontSize="11.5" fill="#e6edf3">Pick &amp; pack</text>
<rect x="700" y="342" width="120" height="44" rx="10" fill="#16212f" stroke="#7fa8ff" strokeWidth="1.8" />
<text x="760.0" y="368.0" textAnchor="middle" fontSize="11.5" fill="#e6edf3">Ship</text>
<polygon points="574,166 666,166 680,188.0 666,210 574,210 560,188.0" fill="#16212f" stroke="#e6edf3" strokeWidth="1.8" />
<text x="620.0" y="192.0" textAnchor="middle" fontSize="11.5" fill="#e6edf3">Notify customer</text>
<polygon points="754,78 860,78 846,122 740,122" fill="#16212f" stroke="#f87171" strokeWidth="1.8" />
<text x="800.0" y="104.0" textAnchor="middle" fontSize="11.5" fill="#e6edf3">Delivery confirmed</text>
<g><circle cx="520" cy="254" r="10" fill="#f8991d" stroke="#0a1119" strokeOpacity="0.4" /><text x="520" y="257.8" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#14161c">2</text></g>
</svg>
                <figcaption>
                  A process as Loom draws it: Lanes are the rows, Steps wear the shape of the Role doing them, and Lines
                  carry the work between them — thicker lines are the main route. Here the handoff from Sales to Finance
                  waits three days, the credit check has two comments from the team, and the dashed red line is a loop
                  back for rework. Those are the knots worth untying.
                </figcaption>
              </figure>
            </div>
          </section>

          <section id="terms">
            <div className="wrap">
              <div className="kicker">Vocabulary</div>
              <h2 className="section-title">Five pieces, nested in this order.</h2>
              <p className="lede">The whole model is just these five things, each one living inside the last.</p>

              <div className="term-grid">
                <div className="term">
                  <svg className="glyph" viewBox="0 0 30 30" aria-hidden="true">
                    <rect x="2" y="2" width="26" height="26" rx="6" fill="none" stroke="currentColor" strokeDasharray="4 3" strokeWidth="2" />
                  </svg>
                  <h3>Workspace</h3>
                  <p>A company&rsquo;s own environment in Loom. Everything else — every process, every person invited — lives inside one.</p>
                  <span className="rel">holds many Processes</span>
                </div>
                <div className="term">
                  <svg className="glyph" viewBox="0 0 30 30" aria-hidden="true">
                    <rect x="3" y="7" width="24" height="16" rx="5" fill="none" stroke="var(--accent)" strokeWidth="2" />
                  </svg>
                  <h3>Process</h3>
                  <p>One real sequence of work, mapped end to end — &ldquo;order to delivery,&rdquo; &ldquo;hiring a role.&rdquo; The unit you&rsquo;d actually fix.</p>
                  <span className="rel">is made of Lanes</span>
                </div>
                <div className="term">
                  <svg className="glyph" viewBox="0 0 30 30" aria-hidden="true">
                    <rect x="2" y="11" width="26" height="8" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <h3>Lane</h3>
                  <p>A horizontal row grouping Steps by stage, team or department. A process has as many Lanes as it needs.</p>
                  <span className="rel">holds an array of Steps</span>
                </div>
                <div className="term">
                  <svg className="glyph" viewBox="0 0 30 30" aria-hidden="true">
                    <rect x="5" y="9" width="20" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <h3>Step</h3>
                  <p>One thing that happens — named with a verb. Steps sit in a Lane and connect to other Steps via Lines.</p>
                  <span className="rel">joined by Lines, owned by a Role</span>
                </div>
                <div className="term">
                  <svg className="glyph" viewBox="0 0 30 30" aria-hidden="true">
                    <line x1="3" y1="15" x2="27" y2="15" stroke="var(--wire)" strokeWidth="2" />
                    <polygon points="27,15 21,11 21,19" fill="var(--wire)" />
                  </svg>
                  <h3>Line</h3>
                  <p>Connects two Steps. Solid for work moving forward, dashed for information only, dotted red for an exception or loop back.</p>
                  <span className="rel">a smart edge between Steps</span>
                </div>
                <div className="term">
                  <svg className="glyph" viewBox="0 0 30 30" aria-hidden="true">
                    <circle cx="15" cy="15" r="11" fill="none" stroke="var(--info)" strokeWidth="2" />
                  </svg>
                  <h3>Role</h3>
                  <p>Who or what does a Step today: a person, a team, a system already in place, or an AI. Shape shows the kind, color shows which one.</p>
                  <span className="rel">attaches to a Step</span>
                </div>
              </div>

              <figure className="diagram" style={{ marginTop: 32 }}>
                <svg
                  viewBox="0 0 900 110"
                  role="img"
                  aria-label="Role shapes: person is a pill, team is a rounded rectangle, system is a square-cornered box, AI is a hexagon, external is a parallelogram."
                >
                  <g transform="translate(40,20)">
                    <rect x="0" y="0" width="140" height="44" rx="22" fill="none" stroke="var(--accent)" strokeWidth="2" />
                    <text x="70" y="27" fontSize="12" textAnchor="middle" fill="currentColor">
                      Person
                    </text>
                  </g>
                  <g transform="translate(210,20)">
                    <rect x="0" y="0" width="140" height="44" rx="14" fill="none" stroke="var(--info)" strokeWidth="2" />
                    <text x="70" y="27" fontSize="12" textAnchor="middle" fill="currentColor">
                      Team
                    </text>
                  </g>
                  <g transform="translate(380,20)">
                    <rect x="0" y="0" width="140" height="44" rx="3" fill="none" stroke="var(--wire)" strokeWidth="2" />
                    <text x="70" y="27" fontSize="12" textAnchor="middle" fill="currentColor">
                      System
                    </text>
                  </g>
                  <g transform="translate(550,20)">
                    <polygon points="16,2 124,2 138,22 124,42 16,42 2,22" fill="none" stroke="currentColor" strokeWidth="2" />
                    <text x="70" y="27" fontSize="12" textAnchor="middle" fill="currentColor">
                      AI
                    </text>
                  </g>
                  <g transform="translate(720,20)">
                    <polygon points="22,2 140,2 118,42 0,42" fill="none" stroke="var(--rework)" strokeWidth="2" />
                    <text x="70" y="27" fontSize="12" textAnchor="middle" fill="currentColor">
                      External
                    </text>
                  </g>
                </svg>
                <figcaption>
                  The same five Role kinds you&rsquo;d see on a mapped Step — color marks which specific Role, shape
                  marks what kind of Role it is.
                </figcaption>
              </figure>
            </div>
          </section>

          <section id="how">
            <div className="wrap closer">
              <div className="kicker">What happens next</div>
              <h2 className="section-title">A mapped Step is where the How gets to start.</h2>
              <p className="lede">
                Once a Step is on the map — its Role, its pain, how often it runs — it&rsquo;s a real candidate for
                change: automate it, assist it with AI, hand it to a different Role, or cut it outright. That&rsquo;s
                the conversation Struinova runs once Loom has done the honest part first.
              </p>
              <div className="hero-ctas">
                <a className="cta-btn" href="/login">
                  Log in
                </a>
              </div>
            </div>
          </section>
        </main>

        <footer>
          <div className="wrap foot-row">
            <span>Loom — a Struinova product</span>
            <nav style={{ display: "flex", gap: 16 }}>
              <a href="/login">Log in</a>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
