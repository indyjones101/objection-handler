// api/scanner.js
export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing or invalid URL" });
  }

  try { new URL(url); } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

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
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `You are analyzing a franchise location's careers/jobs page to extract SDR prospect intelligence.

Target URL: ${url}

Do the following:
1. Fetch or search for this URL to load the page content
2. Find any "Apply", "Apply Now", or job listing links on the page
3. Read the full apply button href/URL — the URL structure itself reveals the ATS provider. Examples:
   - workstream.us/j/... → Workstream
   - jobs.icims.com/jobs/12345/brand-name/... → iCIMS (store ID is the number)
   - brand.talentreef.com/... → TalentReef (subdomain = franchisee slug)
   - recruiting.adp.com/srccar/public/RTI.home?c=... → ADP
   - brand.bamboohr.com/careers/... → BambooHR
   - paradox.ai or olivia... → Paradox
   - app.jobvite.com/... → Jobvite
   - boards.greenhouse.io/... → Greenhouse
   - jobs.lever.co/... → Lever
   - careers.smartrecruiters.com/... → SmartRecruiters
   - ukg.com or ultipro.com → UKG
   - paycom.com/careers/... → Paycom
4. Look for the franchisee entity/LLC name in:
   - EEO statement: "[Entity Name] is an Equal Opportunity Employer"
   - Page footer copyright: "© 2024 [Entity Name]"
   - The apply URL subdomain or path (e.g. "smithenterprises.talentreef.com")
   - HREF links to the franchisee's main talent page
5. Extract location from:
   - Job listing titles (e.g. "Crew Member - Austin, TX")
   - Page title or meta description
   - URL slug (e.g. /austin-texas/ or /tx/austin/)
   - Store address if visible
6. Count the number of open job listings visible
7. Note the store/location ID if present in the URL (usually a number)

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "provider": "exact ATS name: Workstream | iCIMS | TalentReef | ADP | BambooHR | Paradox | UKG | Paycom | Paylocity | Greenhouse | Lever | SmartRecruiters | Workday | Jobvite | JazzHR | Indeed | Other | Unknown",
  "entity": "franchisee LLC or entity name, or null",
  "city": "city name, or null",
  "state": "2-letter state code, or null",
  "store_id": "store or location ID from the URL or page, or null",
  "open_jobs": "number of open job listings visible as integer, or null",
  "apply_url": "the actual apply button href URL found, or null",
  "talent_page": "URL of the franchisee's full talent/careers portal if found, or null",
  "confidence": "High | Medium | Low",
  "notes": "one sentence: what was found and how the ATS was identified"
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
    const textBlocks = data.content?.filter((b) => b.type === "text") || [];
    const rawText = textBlocks.map((b) => b.text).join("");

    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        provider: "Unknown", entity: null, city: null, state: null,
        store_id: null, open_jobs: null, apply_url: null, talent_page: null,
        confidence: "Low", notes: "Could not parse a structured result from this page.",
      };
    }

    return res.status(200).json({
      provider: typeof parsed.provider === "string" ? parsed.provider : "Unknown",
      entity: typeof parsed.entity === "string" ? parsed.entity : null,
      city: typeof parsed.city === "string" ? parsed.city : null,
      state: typeof parsed.state === "string" ? parsed.state : null,
      store_id: parsed.store_id ?? null,
      open_jobs: typeof parsed.open_jobs === "number" ? parsed.open_jobs : null,
      apply_url: typeof parsed.apply_url === "string" ? parsed.apply_url : null,
      talent_page: typeof parsed.talent_page === "string" ? parsed.talent_page : null,
      confidence: ["High", "Medium", "Low"].includes(parsed.confidence) ? parsed.confidence : "Low",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    });

  } catch (err) {
    console.error("Scanner handler error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}
