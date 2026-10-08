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
                <svg
                  viewBox="0 0 900 300"
                  role="img"
                  aria-label="A Workspace contains many Processes; one Process is expanded to show it holds Lanes, which hold Steps joined by Lines."
                >
                  <rect
                    x="20"
                    y="20"
                    width="860"
                    height="140"
                    rx="16"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.35"
                    strokeWidth="1.6"
                    strokeDasharray="7 6"
                  />
                  <text x="40" y="44" fontSize="13" fontWeight="600" fill="currentColor" opacity="0.7">
                    WORKSPACE — one company&rsquo;s environment
                  </text>

                  <g>
                    <rect x="48" y="62" width="230" height="78" rx="12" fill="var(--panel)" stroke="currentColor" strokeOpacity="0.3" />
                    <text x="66" y="90" fontSize="13" fill="currentColor" opacity="0.85">
                      Hiring a role
                    </text>
                    <text x="66" y="110" fontSize="11" fill="currentColor" opacity="0.5">
                      Process
                    </text>
                  </g>
                  <g>
                    <rect x="305" y="62" width="230" height="78" rx="12" fill="var(--panel)" stroke="var(--accent)" strokeWidth="2" />
                    <text x="323" y="90" fontSize="13" fontWeight="600" fill="currentColor">
                      Order to delivery
                    </text>
                    <text x="323" y="110" fontSize="11" fill="var(--accent)">
                      Process · expanded below
                    </text>
                  </g>
                  <g>
                    <rect x="562" y="62" width="230" height="78" rx="12" fill="var(--panel)" stroke="currentColor" strokeOpacity="0.3" />
                    <text x="580" y="90" fontSize="13" fill="currentColor" opacity="0.85">
                      Support escalation
                    </text>
                    <text x="580" y="110" fontSize="11" fill="currentColor" opacity="0.5">
                      Process
                    </text>
                  </g>

                  <line x1="420" y1="140" x2="420" y2="180" stroke="var(--accent)" strokeWidth="2" />
                  <polygon points="420,186 414,176 426,176" fill="var(--accent)" />

                  <rect x="60" y="192" width="780" height="46" rx="8" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.18" />
                  <text x="40" y="219" fontSize="11" fill="currentColor" opacity="0.6" transform="rotate(-90 40 219)" textAnchor="middle">
                    LANE
                  </text>
                  <text x="72" y="208" fontSize="11" fill="currentColor" opacity="0.65">
                    Sales
                  </text>
                  <rect x="130" y="198" width="86" height="34" rx="7" fill="var(--panel)" stroke="currentColor" strokeOpacity="0.35" />
                  <text x="173" y="219" fontSize="11" textAnchor="middle" fill="currentColor">
                    Quote sent
                  </text>
                  <rect x="300" y="198" width="86" height="34" rx="7" fill="var(--panel)" stroke="currentColor" strokeOpacity="0.35" />
                  <text x="343" y="219" fontSize="11" textAnchor="middle" fill="currentColor">
                    PO received
                  </text>

                  <rect x="60" y="246" width="780" height="46" rx="8" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.18" />
                  <text x="72" y="262" fontSize="11" fill="currentColor" opacity="0.65">
                    Fulfilment
                  </text>
                  <rect x="560" y="252" width="86" height="34" rx="7" fill="var(--panel)" stroke="currentColor" strokeOpacity="0.35" />
                  <text x="603" y="273" fontSize="11" textAnchor="middle" fill="currentColor">
                    Pick &amp; pack
                  </text>
                  <rect x="700" y="252" width="86" height="34" rx="7" fill="var(--panel)" stroke="currentColor" strokeOpacity="0.35" />
                  <text x="743" y="273" fontSize="11" textAnchor="middle" fill="currentColor">
                    Shipped
                  </text>

                  <line x1="216" y1="215" x2="300" y2="215" stroke="var(--wire)" strokeWidth="2" />
                  <polygon points="300,215 291,211 291,219" fill="var(--wire)" />
                  <line x1="343" y1="232" x2="603" y2="252" stroke="var(--wire)" strokeWidth="2" />
                  <polygon points="603,252 593,250 596,259" fill="var(--wire)" />
                  <line x1="646" y1="269" x2="700" y2="269" stroke="var(--wire)" strokeWidth="2" />
                  <polygon points="700,269 691,265 691,273" fill="var(--wire)" />
                  <line x1="786" y1="260" x2="820" y2="220" stroke="var(--rework)" strokeWidth="2" strokeDasharray="2 5" />
                  <text x="800" y="238" fontSize="9.5" fill="var(--rework)" opacity="0.85">
                    rework
                  </text>
                </svg>
                <figcaption>
                  One Workspace holds several Processes side by side. Opening &ldquo;Order to delivery&rdquo; shows its
                  Lanes (Sales, Fulfilment) as rows, each holding Steps connected by Lines — the gold line is
                  ordinary flow, the dashed red line is a loop back for rework.
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
