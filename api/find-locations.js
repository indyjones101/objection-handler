// api/find-locations.js
// Given a brand name, finds franchise career page URLs to scan

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { brand, limit = 50 } = req.body;
  if (!brand || typeof brand !== "string") {
    return res.status(400).json({ error: "Missing brand name" });
  }

  const maxUrls = Math.min(Math.max(parseInt(limit) || 50, 5), 200);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Find up to ${maxUrls} franchise location career/jobs page URLs for "${brand}".

Do multiple web searches to find individual franchise location career pages.
Search for things like:
- "${brand} franchise careers apply jobs -workstream"
- "${brand}" franchise "apply now" jobs -site:workstream.us
- "${brand}" franchisee hiring "equal opportunity employer"
- "${brand}" site:talentreef.com OR site:icims.com OR site:bamboohr.com OR site:adp.com

IMPORTANT: Do NOT return any URLs containing "workstream.us" — those are existing customers and must be excluded. All other ATS providers (TalentReef, iCIMS, ADP, BambooHR, Paradox, UKG, Paycom, etc.) are fine and desirable.

I need individual location career URLs — NOT the corporate careers page.
Individual franchise pages often look like:
- https://brand.talentreef.com/...
- https://jobs.icims.com/jobs/brand/...
- https://brand.bamboohr.com/careers/...
- https://recruiting.adp.com/srccar/brand/...

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "urls": ["url1", "url2", "url3", ...],
  "total_found": 25,
  "notes": "brief note about what sources were found"
}

Find up to ${maxUrls} unique franchise location URLs. Stop once you have ${maxUrls}. Exclude corporate HQ pages, LinkedIn, Indeed, and workstream.us.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return res.status(502).json({ error: "Upstream API error", detail: errText });
    }

    const data = await response.json();
    const textBlocks = data.content?.filter((b) => b.type === "text") || [];
    const rawText = textBlocks.map((b) => b.text).join("");

    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { urls: [], total_found: 0, notes: "Could not find URLs for this brand." };
    }

    // Dedupe, validate, and filter out workstream.us URLs only
    const validUrls = [...new Set(parsed.urls || [])]
      .filter((u) => {
        try { new URL(u); return true; } catch { return false; }
      })
      .filter((u) =>
        !u.includes("linkedin.com") &&
        !u.includes("indeed.com") &&
        !u.includes("workstream.us")
      )
      .slice(0, maxUrls);

    return res.status(200).json({
      urls: validUrls,
      total_found: validUrls.length,
      notes: parsed.notes || "",
    });

  } catch (err) {
    console.error("find-locations error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}
