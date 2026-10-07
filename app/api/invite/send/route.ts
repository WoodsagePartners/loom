import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Emails an invite link. The invites table's own row-level security decides who may
// read the invite, so only an owner/admin of the workspace can trigger a send.
const FROM = "Loom <loom@auth.struinova.com>";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Email isn't configured yet." }, { status: 503 });

  const { inviteId, lang } = (await req.json().catch(() => ({}))) as { inviteId?: string; lang?: string };
  if (!inviteId) return NextResponse.json({ error: "Missing invite." }, { status: 400 });

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: inv } = await sb.from("invites").select("email, role, token, org_id, accepted_at").eq("id", inviteId).maybeSingle();
  if (!inv || inv.accepted_at) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  const { data: org } = await sb.from("orgs").select("name").eq("id", inv.org_id).maybeSingle();

  const de = lang === "de";
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const link = `${origin}/invite/${inv.token}`;
  const who = esc(auth.user.user_metadata?.full_name || auth.user.email || "A colleague");
  const ws = esc(org?.name ?? "a workspace");

  const T = de
    ? {
        subject: `Einladung zu „${org?.name ?? "Loom"}“ in Loom`,
        hi: "Willkommen bei Loom",
        body: `${who} hat Sie in den Arbeitsbereich <b>${ws}</b> eingeladen. In Loom bilden Sie gemeinsam einen Prozess ab: Bahnen, Schritte, Rollen und Linien – und finden, wo er hakt.`,
        cta: "Einladung annehmen",
        fine: `Melden Sie sich mit genau dieser E-Mail-Adresse (${esc(inv.email)}) an. Die Einladung gilt 14 Tage. Falls der Button nicht funktioniert, kopieren Sie diesen Link:`,
        help: "Fragen? Antworten Sie einfach auf diese E-Mail.",
      }
    : {
        subject: `You're invited to “${org?.name ?? "Loom"}” on Loom`,
        hi: "Welcome to Loom",
        body: `${who} invited you to the workspace <b>${ws}</b>. In Loom you map a process together — lanes, steps, roles and lines — and find where it snags.`,
        cta: "Accept your invitation",
        fine: `Sign in with exactly this email address (${esc(inv.email)}). The invitation is valid for 14 days. If the button doesn't work, copy this link:`,
        help: "Questions? Just reply to this email.",
      };

  const logo = `${origin}/struinova-logo.png`;
  const html = `<!doctype html><html><body style="margin:0;background:#f3f1ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d1f25">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ee;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#ffffff;padding:28px 32px 18px;border-bottom:3px solid #f8991d">
  <img src="${logo}" alt="Struinova" width="82" height="73" style="display:block;width:82px;height:auto;border:0;color:#1d2a44;font-size:20px;letter-spacing:.14em">
</td></tr>
<tr><td style="padding:36px 32px 8px">
  <div style="font-size:12px;letter-spacing:.16em;color:#e0771a;font-weight:600">THE LOOM</div>
  <h1 style="margin:8px 0 14px;font-size:24px;font-weight:600;line-height:1.25">${T.hi}</h1>
  <p style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#3a3d46">${T.body}</p>
  <a href="${link}" style="display:inline-block;background:#f8991d;color:#14161c;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px">${T.cta}</a>
  <p style="margin:28px 0 6px;font-size:12.5px;line-height:1.55;color:#6b6f7a">${T.fine}</p>
  <p style="margin:0 0 24px;font-size:12px;word-break:break-all"><a href="${link}" style="color:#e0771a">${link}</a></p>
</td></tr>
<tr><td style="padding:0 32px 30px"><p style="margin:0;font-size:12.5px;color:#6b6f7a;border-top:1px solid #ecebe8;padding-top:18px">${T.help}<br>Struinova Innovation · loom.struinova.com</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${T.hi}\n\n${T.body.replace(/<[^>]+>/g, "")}\n\n${T.cta}: ${link}\n\n${T.help}`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [inv.email], reply_to: "ron@struinova.com", subject: T.subject, html, text }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    return NextResponse.json({ error: j?.message ?? "The email service refused the send." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
