// Serverless function: converts a description into a Lit element specification using Groq.
// Relies on GROQ_API_KEY environment variable.
import { generateComponent } from '../server/generator.js';

// The verified model ID active in your Groq account.
const MODEL = 'openai/gpt-oss-120b';

const SYSTEM = `You are a Lit component specifier. Return ONLY a valid JSON object matching this schema:
{
  "name": "kebab-case-with-hyphen",
  "description": "a concise single sentence description",
  "props": [
    {"name": "camelCaseName", "type": "string|number|boolean", "default": "valid JS literal value"}
  ],
  "events": [
    {"name": "kebab-case-event"}
  ]
}
No preambles, no explanations, no markdown block wrappers (do not include \`\`\`json).`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GROQ_API_KEY' });

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length > 300) return res.status(400).json({ error: 'Invalid prompt' });

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 1500, // Presupuesto de tokens elevado para evitar truncamiento
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 500);
      console.error('Groq error', upstream.status, detail);
      return res.status(502).json({ error: 'Upstream error' });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return res.status(502).json({ error: 'Empty model response' });

    let spec;
    try {
      spec = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: 'Model returned invalid JSON' });
    }

    let out;
    try {
      out = generateComponent(spec);
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }

    return res.status(200).json({ tag: out.tag, source: out.source });
  } catch (err) {
    console.error('generate failed', err?.name);
    return res.status(502).json({ error: 'Generation failed' });
  }
}
