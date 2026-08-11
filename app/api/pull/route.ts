import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickTechnique, buildTechniqueGuidance, type Technique } from "@/lib/techniques";

// Server-side proxy for provocation pulls. The Anthropic key lives only in
// this route's environment — it never reaches the browser. Mirrors the
// SYS prompt and pull() logic from the-loom.html, ported to a real endpoint.

const SYS = `You are the provocation engine inside The Loom, an innovation instrument by Struinova Innovation.

ABSOLUTE RULES:
- You never provide solutions, answers, recommendations or advice.
- You produce PROVOCATIONS: sharp observations and questions that make a person see their situation differently.
- The human is the expert and the hero. You ask the awkward question.
- Be specific to the material given. Never generic. If material is thin, provoke about what is missing rather than inventing facts.
- Never invent facts, figures or events. Speculation must read as a question.
- Short. Two or three sentences maximum each. No preamble, no encouragement, no summary.
- Never use em dashes or en dashes. Use commas and periods.

Return ONLY a JSON array of 2 to 3 strings. No markdown fence, no commentary.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { orgId, prompt, usedTechniques = [], model = "claude-sonnet-5" } = await req.json();
  if (!orgId || !prompt) {
    return NextResponse.json({ error: "orgId and prompt are required." }, { status: 400 });
  }

  // Confirm the caller actually belongs to the org they're pulling for.
  // RLS on the DB tables already enforces this at the data layer; this is a
  // second check before we spend a model call on their behalf.
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member of that org." }, { status: 403 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });

  // Pick a technique from the org's library, if one has been seeded. Falls
  // back to the generic provocation prompt if the library is empty rather
  // than failing the pull entirely.
  const { data: libraryRows } = await supabase
    .from("library_techniques")
    .select("id, key, plain, exec, exemplars, antipatterns, stats")
    .eq("org_id", orgId);

  const techniques = (libraryRows ?? []) as unknown as Technique[];
  const technique = pickTechnique(usedTechniques, techniques);

  const system = technique ? `${SYS}\n\n${buildTechniqueGuidance(technique)}` : SYS;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!r.ok) {
    const detail = await r.text();
    return NextResponse.json({ error: `Anthropic API ${r.status}: ${detail}` }, { status: 502 });
  }

  const json = await r.json();
  const text = json.content.map((b: any) => b.text || "").join("");

  // Track that this technique got pulled — the library learns its own
  // effectiveness over time instead of sitting there as static reference
  // data. Fire-and-forget: a failed stats bump shouldn't fail the pull.
  if (technique) {
    void supabase
      .from("library_techniques")
      .update({ stats: { ...technique.stats, pulls: technique.stats.pulls + 1 } })
      .eq("id", technique.id);
  }

  return NextResponse.json({
    text,
    technique: technique ? { id: technique.id, key: technique.key } : null,
  });
}
