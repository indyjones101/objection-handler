// api/find-locations.js
export const maxDuration = 60;

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
            content: `Search the web for franchise location career/jobs pages for "${brand}". 

Search for: "${brand} franchise careers" and "${brand} franchise jobs apply"

Find up to ${maxUrls} URLs that are individual franchise location hiring pages. These will typically be on ATS platforms like talentreef.com, icims.com, bamboohr.com, adp.com, paradox.ai, paycom.com, etc.

Do NOT include:
- workstream.us URLs (those are existing customers)
- linkedin.com or indeed.com
- The brand's main corporate careers page

After searching, respond with ONLY this JSON and nothing else:
{
  "urls": ["url1", "url2", "url3"],
  "notes": "brief description of what you found"
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
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
      // Try to extract URLs directly from the text if JSON parse fails
      const urlMatches = rawText.match(/https?:\/\/[^\s"',\]]+/g) || [];
      parsed = { urls: urlMatches, notes: "Extracted from text" };
    }

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
