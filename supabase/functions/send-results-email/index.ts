// @ts-nocheck — Deno runtime file, not Node.js

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email, topResults, totalAnalysed } = await req.json();
    if (!email || !Array.isArray(topResults)) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400,
        headers: cors,
      });
    }

    const html = buildEmail(topResults, totalAnalysed ?? topResults.length);
    const topSport = topResults[0]?.sport ?? "your top match";
    const from = Deno.env.get("SENDER_EMAIL") ?? "BUILTFOR <contact@builtfor.fit>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: `Your results: ${topSport} is your top match`,
        html,
      }),
    });

    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

// ── Tier helpers ─────────────────────────────────────────────────────────────

const TIER: Record<string, { fg: string; bg: string; pips: string }> = {
  diamond: { fg: "#c8ff3d", bg: "#1d3d1a", pips: "◆◆◆◆" },
  gold:    { fg: "#f5a623", bg: "#3d2e00", pips: "◆◆◆" },
  silver:  { fg: "#d0d0d0", bg: "#2e2e2e", pips: "◆◆" },
  bronze:  { fg: "#e8a87c", bg: "#3b2416", pips: "◆" },
};

function getTier(score: number): string {
  if (score >= 85) return "diamond";
  if (score >= 70) return "gold";
  if (score >= 55) return "silver";
  return "bronze";
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmail(results: any[], totalAnalysed: number): string {
  const top5 = results.slice(0, 5);

  const rows = top5
    .map((r, i) => {
      const score = Math.round(r.total);
      const tier = getTier(score);
      const { fg, bg, pips } = TIER[tier];
      // Bar is 300 logical units wide; scale score (0-100) → pixels
      const filled = Math.round(score * 3);
      const empty = 300 - filled;

      return `
    <tr>
      <td style="padding:20px 0;border-bottom:1px solid #1e1e1e;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" valign="top" style="padding-right:14px;padding-top:4px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:900;color:#c8ff3d;line-height:1;">${i + 1}</span>
            </td>
            <td valign="top">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:900;color:#f0f0f0;text-transform:uppercase;letter-spacing:0.02em;line-height:1;margin-bottom:10px;">${r.sport}</div>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td style="width:${filled}px;height:5px;background:${fg};border-radius:2px 0 0 2px;"></td>
                  <td style="width:${empty}px;height:5px;background:#1e1e1e;border-radius:0 2px 2px 0;"></td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${bg};color:${fg};font-family:'Courier New',Courier,monospace;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:3px 8px;border-radius:2px;">${pips}&nbsp;${tier.toUpperCase()}</td>
                  <td style="width:12px;"></td>
                  <td style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#666;letter-spacing:0.03em;">Built for:&nbsp;${Math.round(r.builtFor)}&nbsp;&nbsp;·&nbsp;&nbsp;Enjoyment:&nbsp;${Math.round(r.enjoyment)}</td>
                </tr>
              </table>
            </td>
            <td width="58" valign="top" align="right">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:46px;font-weight:900;color:${fg};line-height:1;">${score}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your BUILTFOR results</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
  <tr>
    <td align="center" style="padding:48px 16px 64px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" border="0">

        <!-- HEADER -->
        <tr>
          <td style="padding-bottom:28px;border-bottom:1px solid #1e1e1e;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:#f0f0f0;text-transform:uppercase;letter-spacing:0.04em;">BUILT</span><span style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:#c8ff3d;letter-spacing:0.04em;">FOR</span>
                </td>
                <td align="right" valign="middle">
                  <span style="font-family:'Courier New',Courier,monospace;font-size:10px;color:#444;letter-spacing:0.15em;text-transform:uppercase;">SPORT MATCH REPORT</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HEADLINE -->
        <tr>
          <td style="padding:36px 0 10px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:36px;font-weight:900;color:#f0f0f0;text-transform:uppercase;line-height:1.05;letter-spacing:0.01em;">YOUR TOP MATCHES</div>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:28px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666;line-height:1.6;">${totalAnalysed} sports analysed against your body, fitness and preferences. Here are your top ${top5.length}.</span>
          </td>
        </tr>

        <!-- SPORT ROWS -->
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rows}
            </table>
          </td>
        </tr>

        <!-- SCORE LEGEND -->
        <tr>
          <td style="padding:16px 0 0;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:'Courier New',Courier,monospace;font-size:10px;color:#444;letter-spacing:0.1em;text-transform:uppercase;">SCORE KEY:</td>
                <td style="width:12px;"></td>
                <td style="font-family:'Courier New',Courier,monospace;font-size:10px;color:#1d3d1a;background:#c8ff3d;padding:2px 6px;border-radius:2px;letter-spacing:0.08em;">◆◆◆◆ 85+ DIAMOND</td>
                <td style="width:8px;"></td>
                <td style="font-family:'Courier New',Courier,monospace;font-size:10px;color:#f5a623;background:#3d2e00;padding:2px 6px;border-radius:2px;letter-spacing:0.08em;">◆◆◆ 70 GOLD</td>
                <td style="width:8px;"></td>
                <td style="font-family:'Courier New',Courier,monospace;font-size:10px;color:#d0d0d0;background:#2e2e2e;padding:2px 6px;border-radius:2px;letter-spacing:0.08em;">◆◆ 55 SILVER</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:40px 0 8px;">
            <a href="https://builtfor.fit" style="display:block;background:#c8ff3d;color:#000;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;padding:20px 28px;text-align:center;">SEE ALL YOUR RESULTS &#8594;</a>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:40px;text-align:center;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#444;">Your full results are saved — tap above to explore all ${totalAnalysed} sport scores.</span>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding-top:24px;border-top:1px solid #1a1a1a;">
            <p style="font-family:'Courier New',Courier,monospace;font-size:10px;color:#333;line-height:2;text-transform:uppercase;letter-spacing:0.1em;margin:0;">
              BUILTFOR &nbsp;·&nbsp; Sport-match engine &nbsp;·&nbsp; ${totalAnalysed} sports in database<br>
              <a href="https://builtfor.fit" style="color:#444;text-decoration:none;">rafferj-afk.github.io/builtfor</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
