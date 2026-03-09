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
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `You are researching what job application / ATS platform the franchise brand "${brand}" uses.

STEP 1 - Search for their jobs/careers pages directly:
Search: ${brand} jobs apply now
Search: ${brand} franchise careers hiring
Search: ${brand} site:workstream.us
Search: ${brand} site:talentreef.com
Search: ${brand} site:snagajob.com
Search: ${brand} site:icims.com

STEP 2 - Look at any URLs you find. The domain tells you the ATS:
- workstream.us → Workstream
- talentreef.com → TalentReef  
- snagajob.com → Snagajob
- icims.com → iCIMS
- jobvite.com → Jobvite
- greenhouse.io → Greenhouse
- lever.co → Lever
- bamboohr.com → BambooHR
- paylocity.com → Paylocity
- paycom.com → Paycom
- jazzhr.com → JazzHR
- fountain.com → Fountain
- harri.com → Harri
- applicantpro.com → ApplicantPro
- peoplematter.com → PeopleMatter
- myworkdayjobs.com → Workday
- ultipro.com or ukg.com → UKG

STEP 3 - Also estimate how many ${brand} franchise locations are in ${stateList}.
Search: ${brand} franchise locations ${stateList}
Search: ${brand} number of locations ${states[0]}

After searching, return ONLY this JSON (no markdown, no extra text):
{
  "brand": "${brand}",
  "ats": "TalentReef",
  "ats_confidence": "high",
  "is_workstream": false,
  "location_count_in_states": 47,
  "total_locations_nationwide": 1200,
  "states_searched": "${stateList}",
  "evidence_url": "https://smoothieking.talentreef.com/...",
  "notes": "Found active job postings on TalentReef. Approximately 47 TX locations per franchise directory."
}

Rules:
- ats_confidence: "high" = found actual URL, "medium" = strong inference, "low" = couldn't confirm
- is_workstream: true ONLY if you found actual workstream.us URLs for this brand
- location_count_in_states: integer estimate, or -1 if truly unknown
- total_locations_nationwide: integer, or -1 if unknown
- evidence_url: an actual URL you found, or null
- Do NOT return the fallback "Could not determine" — always do your best with what you find`
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
      // Strip markdown fences and find the JSON object
      const clean = rawText.replace(/```json|```/g, "").trim();
      // Find first { to last } in case there's surrounding text
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      const jsonStr = start !== -1 && end !== -1 ? clean.slice(start, end + 1) : clean;
      parsed = JSON.parse(jsonStr);
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
        notes: "Search completed but ATS could not be confirmed. Try searching manually.",
      };
    }

    // Sanitize all string fields to remove encoding artifacts
    const sanitize = (v) => typeof v === "string" ? v.replace(/[^\x20-\x7E\n]/g, "").trim() : v;
    Object.keys(parsed).forEach(k => { parsed[k] = sanitize(parsed[k]); });

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("find-locations error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}
