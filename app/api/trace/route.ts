import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Server-side proxy for trace-back retrospectives. Same shape as /api/pull
// (Anthropic key never reaches the browser) but a different job: given an
// ordered chain of steps from the working question down to a knot, name
// what else could have been pulled at each step, then summarize the arc.

const SYS = `You are the retrospective engine inside The Loom, an innovation instrument by Struinova Innovation.

ABSOLUTE RULES:
- You never provide solutions, answers, recommendations or advice.
- For each numbered step given, in order, produce exactly one short alternate: something else that could have been pulled or considered at that exact step instead of what was actually chosen. Do not critique or evaluate the actual choice, just name a road not taken.
- After all steps, produce one short summary of the arc of this line of inquiry so far. Plain and factual, no praise, no encouragement, no advice.
- Be specific to the material given. Never generic. Never invent facts, figures or events, speculation must read as a possibility, not a claim.
- Each alternate is one sentence. The summary is two to three sentences.
- Never use em dashes or en dashes. Use commas and periods.

Return ONLY JSON in this exact shape: {"steps": ["...", "..."], "summary": "..."}. The steps array must have exactly as many entries as there were numbered steps in the input, in the same order. No markdown fence, no commentary.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { orgId, prompt, model = "claude-sonnet-5" } = await req.json();
  if (!orgId || !prompt) {
    return NextResponse.json({ error: "orgId and prompt are required." }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member of that org." }, { status: 403 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });

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
      system: SYS,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!r.ok) {
    const detail = await r.text();
    return NextResponse.json({ error: `Anthropic API ${r.status}: ${detail}` }, { status: 502 });
  }

  const json = await r.json();
  const text = json.content.map((b: any) => b.text || "").join("");
  return NextResponse.json({ text });
}
