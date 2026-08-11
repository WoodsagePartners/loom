# The Loom — Build Spec

Struinova Innovation · written by the machine, judged by the human · 2026-07-26

---

## Part One: the method, aimed at itself

Before writing this the design was run through four of our own lenses. Three of them changed the spec.

### First principles

Ron is one person, on site one to three days a week, for eight to twelve weeks. He is paid for judgment. His differentiator is that capability stays behind. The work goes cold between visits.

So the job this application exists to do is exactly one thing:

> **Keep a line of inquiry alive and advancing when the facilitator is not in the room.**

Four things are genuinely required. Somewhere for the inquiry to live that is not Ron's head. A way to advance it that does not need Ron. A way for Ron to re-enter without re-learning. Evidence that it advanced.

**The graph is not on that list.** The graph is a way of seeing, not the point.

### Invert

*The canvas should be the main view.* Inverted: the **working question is the main view**. The question is the product. Everything else is apparatus for interrogating it. This also dissolves the complaint about empty threads eating prime screen space, because an empty thread still has a question, and the question deserves the room.

*More nodes means more progress.* Inverted: fewer and better. Pull count is vanity. The scoreboard rewards reframes and assumptions retired into facts, never volume.

*The user always drives.* Inverted: the app may hold an opinion about what has not been done. Not thinking, noticing.

### Outsider view

Why must someone know what "first principles" means before using this? Noble's team has to run it **without Ron in the room**, which is the entire thesis, and the controls are labelled in a language only Ron speaks. Every technique gets a plain description of what it does to your thinking. The name stays, because the name is the teaching.

### Absence

What nobody said in forty turns of conversation:

1. **The other people.** Every principle assumes several humans. The build is single player and therefore cannot yet do the thing we said was the point.
2. **Failure.** We have "cut," which is deliberate abandonment. We have no state for a thread worked honestly that yielded nothing. That is most of innovation work.
3. **The client's own words.** Everything is Ron's input or model output. We drew fibers and never built them.
4. **Reading.** The app is entirely about producing. No quiet mode for sitting with what is there.

---

## Part Two: what is settled

**Principles**

- The machine asks. It does not answer. The one exception is fact finding, which is step two work, and it must always mark confidence and name who would really know.
- The machine proposes, the human names.
- Automate the application of a technique, never the judgment.
- Nothing becomes part of the record without a person putting it there.
- Chains terminate, loops drift.
- Thinking should be demonstrably deliberate. Chosen friction is the feature.

**Vocabulary:** thread · pull · woven in · loose end · tied off · untie · cut · slack · ledger · night shift

**Killed, stays killed:** solo lead generation version, portfolio collision detector, generic question generator. Reasons in `BACKLOG.md`.

---

## Part Three: the build

### Architecture of attention

**1. The Question.** Top of screen, large, always. Earlier versions ghosted above, struck through. When a question is retired and replaced, that is the most important event in the application and it should feel like one.

**2. The Work.** The graph, beneath the question. Each node is one technique applied. Pull again from the same node and the thread forks. The canvas **sizes to its content** and never reserves empty space.

**3. The Reservoir.** Loose ends, held per node, shown on hover, considered on click, individually pullable. Unpulled is stored potential, never waste.

**4. The Record.** The ledger, a permanent presence rather than a corner chip. Append only. Derived names. State snapshots.

### The scoreboard

Replaces the scaffold mood bar, keeps the handwritten line as a caption. Measures **method, not output**:

| Metric | Why it is the right thing to count |
|---|---|
| Questions retired | The highest value event. Count it first. |
| Assumptions turned into facts | Step two work made visible. |
| Loose ends held vs pulled | Stored potential. High held is good, not a backlog. |
| Pulls run by the team vs by you | The actual ZPD fade. This number should climb. |
| Days since this thread moved | Slack made numeric. |
| Threads live · quiet · cut | Breadth, and the courage to close things. |

Deliberately absent: total pulls, ideas generated, node count. Vanity metrics teach the wrong behaviour.

### Techniques, in plain language

- **first principles** — strip it down to what is actually true
- **reframe** — change the question, not the answer
- **invert** — assume the opposite and see what holds
- **outsider view** — how this looks to someone who has never worked here
- **analogous** — how a completely different field solves this shape of problem
- **scope shift** — the same thing at the crew, the site, the company
- **absence** — what nobody has said yet
- **forced collision** — mash this against another thread

### The technique library, and how it learns

The most valuable thing in this application is not the graph and not the ledger. It is the accumulated craft of how each technique is actually executed. Everything else is apparatus.

Static strings written from a generic understanding have no moat. A living record that improves with use is the moat.

**A technique is a record, not a string.**

```
name          first principles
family        divergent / convergent / reframing
intent        what it does to thinking
plain         client-facing description, no jargon
execution     current instruction given to the engine
variants      [{ name, when to use, execution }]
exemplars     provocations the facilitator kept, with context
antipatterns  what this technique does badly, learned not hardcoded
craft notes   the facilitator's own accumulated instruction
stats         pulls, kept, discarded, keep rate
provenance    who changed what, when, and why
```

**The learning loop is already running and currently discarded.** Every WEAVE IN is a master facilitator judging a provocation worth keeping. Every DISCARD is the inverse. That signal exists today and goes in the bin. Kept provocations become exemplars, so the engine sees what good looks like *in this facilitator's judgment*.

Refinements are proposed by the app and **accepted by the human**. The machine notices the pattern. The person decides whether it becomes craft.

**Learning is for the instrument, not from an engagement.** Refinements are general by default. Domain and client material stays context for a single pull and is never promoted into craft. A library overfit to one industry is worth less than the vanilla definition it replaced.

**Variants are first class.** Worked example:

> Analogous thinking is conventionally pairwise. With two cases people mostly map surface features. With three or four unrelated cases, abstraction is forced upward, because a property surviving across four domains is almost certainly structural. The inverse sharpens too: a property present in only one of four becomes a novelty candidate rather than merely a difference. The harvest sits between and betwixt the set, and pairwise comparison cannot produce it.

So the library ships `analogous (pairwise)` and `analogous (triangulation)` as distinct instruments. See `RESEARCH.md` for the evidence base.

**Keep rate is a real metric.** A technique kept twenty percent of the time is either badly executed or reached for at the wrong moments.

**Deliberate amnesia.** Exemplars calcify. There is an explicit way to run a technique cold, ignoring the library entirely.

**The library has its own ledger.** Append only, versioned, with reasons. The facilitator can read how their own method evolved. Capability staying behind, pointed at the methodology itself. It exports as data the facilitator owns.

### Fibers

A way for other people's words to enter without waiting on a backend. Paste raw material into a thread: an interview note, a message from the rig, a comment from a meeting. Attributed, dated, marked as **someone else's voice**, and available to every pull as context.

### The state we were missing

A third resting state between live and cut: **worked and quiet.** Honestly attempted, nothing yielded yet, not abandoned. The scoreboard treats it as neutral. Innovation work needs somewhere to put a real dead end that is not a confession.

### The app's opinion

A single quiet line, never a popup, noticing what has not been done. Four techniques used and absence never among them. Eleven loose ends and no pulls in two weeks. Nine pulls and the question never reframed. It notices. It never prescribes.

### Night shift

Assignments queued through the day. The app drafts the brief from state: objective, focus, questions, out of bounds, what a good morning looks like. Human edits and approves. Ceremony on handoff. The approved brief goes on the ledger so the shift can be held to it.

### Ledger and deliverables

Append only, derived names, state snapshots. Session Brief first. Movement report by subtraction between any two entries. Every generated document narrates the record, may not add thinking, may not resolve an open question, and must end on what is still open.

---

## Part Four: what is being cut

- The scaffold mood bar, replaced by the scoreboard.
- Fixed canvas geometry, replaced by content sized layout.
- The dock of technique names with no explanation.
- Anything in the current build that no longer pays rent.

## Part Five: risks accepted

1. **Multiplayer capable, not enabled.** Every node, fiber and ledger entry carries an author field from day one even when the author is always Ron. Threads carry an unused participant list. Nothing assumes a single writer. Enabling it later needs a backend, not a rewrite.
2. **No web access.** Fact finding reasons from training with marked uncertainty. A lead and a place to look, never a citation.
3. **One file.** Local, keys in the browser, threads in files Ron owns. Right for now, wrong at scale.
