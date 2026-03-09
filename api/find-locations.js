// api/find-locations.js
// Detects what ATS a franchise brand uses and estimates location count in target states

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { brand, states = [] } = req.body;
  if (!brand || typeof brand !== "string") {
    return res.status(400).json({ error: "Missing brand name" });
  }
  if (!Array.isArray(states) || states.length === 0) {
    return res.status(400).json({ error: "At least one state is required" });
  }
  const stateList = states.join(", ");

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
            content: `Research the franchise brand "${brand}" and determine:
1. What hiring/ATS platform do their franchise locations use to post jobs?
2. How many franchise locations do they have in: ${stateList}?

Do web searches like:
- "${brand}" site:workstream.us
- "${brand}" site:talentreef.com
- "${brand}" site:icims.com
- "${brand}" site:snagajob.com
- "${brand}" site:jobvite.com
- "${brand} franchise locations ${stateList}"
- "${brand} franchise careers apply"

Known ATS platforms to detect: Workstream, TalentReef, iCIMS, Snagajob, Jobvite, Greenhouse, Lever, BambooHR, ADP, Paylocity, Paycom, Hirequest, JazzHR, Fountain, Harri, HotSchedules, ApplicantPro, PeopleMatter, or "Unknown".

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "brand": "${brand}",
  "ats": "TalentReef",
  "ats_confidence": "high",
  "is_workstream": false,
  "location_count_in_states": 47,
  "total_locations_nationwide": 1200,
  "states_searched": "${stateList}",
  "evidence_url": "https://example.talentreef.com/...",
  "notes": "Found on TalentReef via search. ~47 TX locations based on franchise disclosure."
}

ats_confidence should be "high" if you found an actual URL, "medium" if inferred, "low" if guessing.
location_count_in_states: best estimate for locations in ${stateList} combined. Use -1 if unknown.
is_workstream: true ONLY if the brand clearly uses Workstream as their ATS.`
          }
        ]
      })
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
      parsed = {
        brand,
        ats: "Unknown",
        ats_confidence: "low",
        is_workstream: false,
        location_count_in_states: -1,
        total_locations_nationwide: -1,
        states_searched: stateList,
        evidence_url: null,
        notes: "Could not determine ATS for this brand.",
      };
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("find-locations error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}
