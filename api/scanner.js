// api/scanner.js
// Vercel serverless function — drop this in your /api folder

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing or invalid URL" });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "interleaved-thinking-2025-01-31",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Analyze this franchise careers/jobs page URL: ${url}

Please web search for this URL and any related job postings to determine:
1. Which ATS/hiring software provider they use. Look for URL patterns like workstream.us, talentreef.com, icims.com, adp.com, paradox.ai, ukg.com, paycom.com, paylocity.com, bamboohr.com, greenhouse.io, lever.co, smartrecruiters.com, workday.com, successfactors.com, jazzhr.com in job application URLs.
2. The franchisee entity/LLC name - look for EEO text like "[Entity] is an Equal Opportunity Employer"
3. The location city and state
4. Estimated number of locations this franchisee operates (if detectable from the URL or page)

Respond ONLY with a valid JSON object, no markdown, no explanation, no code fences:
{
  "provider": "one of: Workstream, ADP, TalentReef, iCIMS, Paradox, UKG, Paycom, Paylocity, BambooHR, Greenhouse, Lever, SmartRecruiters, Workday, SuccessFactors, JazzHR, Indeed, Other, Unknown",
  "entity": "franchisee LLC or entity name as a string, or null if not found",
  "city": "city name as a string, or null if not found",
  "state": "2-letter US state code as a string, or null if not found",
  "locations": "estimated number of locations this franchisee runs as an integer, or null",
  "confidence": "High, Medium, or Low",
  "notes": "one short sentence describing what was found or why confidence is low"
}`,
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

    // Extract text from response (may include tool_use blocks from web search)
    const textBlocks = data.content?.filter((b) => b.type === "text") || [];
    const rawText = textBlocks.map((b) => b.text).join("");

    // Parse JSON from response
    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // If JSON parse fails, return a graceful unknown result
      parsed = {
        provider: "Unknown",
        entity: null,
        city: null,
        state: null,
        locations: null,
        confidence: "Low",
        notes: "Could not parse a structured result from this page.",
      };
    }

    // Sanitize and return
    return res.status(200).json({
      provider:   typeof parsed.provider === "string" ? parsed.provider : "Unknown",
      entity:     typeof parsed.entity === "string" ? parsed.entity : null,
      city:       typeof parsed.city === "string" ? parsed.city : null,
      state:      typeof parsed.state === "string" ? parsed.state : null,
      locations:  typeof parsed.locations === "number" ? parsed.locations : null,
      confidence: ["High", "Medium", "Low"].includes(parsed.confidence) ? parsed.confidence : "Low",
      notes:      typeof parsed.notes === "string" ? parsed.notes : "",
    });

  } catch (err) {
    console.error("Scanner handler error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}
