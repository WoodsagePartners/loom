import { NextResponse } from "next/server";

// "Talk to us" form: sends a lead to Ron through Resend. No sign-in needed (it is a sales form),
// so it has a hidden honeypot field and strict length limits.
const FROM = "Loom <loom@auth.struinova.com>";
const TO = "ron@struinova.com";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Email isn't configured yet — please write to ron@struinova.com." }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; email?: string; message?: string; website?: string };
  if (b.website) return NextResponse.json({ ok: true }); // bot: pretend success
  const name = (b.name ?? "").trim().slice(0, 120);
  const email = (b.email ?? "").trim().slice(0, 200);
  const message = (b.message ?? "").trim().slice(0, 4000);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || message.length < 3) return NextResponse.json({ error: "Please add a valid email and a message." }, { status: 400 });
  const html = `<p><b>${esc(name || "(no name)")}</b> &lt;${esc(email)}&gt; wrote from Loom:</p><p style="white-space:pre-wrap">${esc(message)}</p>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject: `Loom – let's talk (${name || email})`, html, text: `${name} <${email}>\n\n${message}` }),
  });
  if (!r.ok) return NextResponse.json({ error: "The email service refused the send." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
