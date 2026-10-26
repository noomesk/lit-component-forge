// Función serverless: convierte una descripción en una especificación de componente con Groq.
// La key vive en GROQ_API_KEY (Vercel), nunca en el navegador.
import { generateComponent } from '../server/generator.js';

const MODEL = 'openai/gpt-oss-20b';

const SYSTEM = `Eres un generador de componentes Lit. Devuelve SOLO JSON válido con esta forma:
{"name":"kebab-case con guion","description":"una frase","props":[{"name":"camelCase","type":"string|number|boolean","default":"valor JS"}],"events":[{"name":"kebab-case"}]}
Sin texto extra, sin markdown.`;

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
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!upstream.ok) {
      console.error('Groq error', upstream.status, await upstream.text());
      return res.status(502).json({ error: 'Upstream error' });
    }
    const data = await upstream.json();
    const spec = JSON.parse(data.choices[0].message.content);
    const out = generateComponent(spec);
    return res.status(200).json({ tag: out.tag, source: out.source });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Generation failed' });
  }
}
