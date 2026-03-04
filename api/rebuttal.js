export const config = { runtime: 'edge' };

const systemPrompt = `You are an expert SDR coach for Workstream, an HR and hiring platform that helps hourly businesses hire up to 70% faster. 

When given an objection from a prospect, respond with exactly 3 rebuttals in JSON format like this:
{
  "rebuttals": [
    { "label": "Curious & Disarming", "text": "rebuttal text here" },
    { "label": "Value-Led", "text": "rebuttal text here" },
    { "label": "Challenge & Redirect", "text": "rebuttal text here" }
  ],
  "tip": "One short coaching tip for handling this objection"
}

Keep each rebuttal to 1-2 sentences max. Make them conversational, confident, and specific to Workstream's value prop around faster hourly hiring. Return ONLY valid JSON, no markdown, no extra text.

SPECIAL RULE: If the objection is about being busy (e.g. "I'm really busy right now"), all 3 rebuttals must:
- Be a single short sentence only — under 15 words
- Acknowledge their time immediately
- End with a micro-hook or quick question that gives them a reason to stay on for just 30 more seconds
- Never ask for a lot of time — just a tiny commitment`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { objection } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Objection: "${objection}"` }],
      }),
    });

    const data = await response.json();
    const raw = data.content.map((i) => i.text || '').join('');
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
