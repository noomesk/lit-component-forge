// Función serverless: convierte una descripción en una especificación de componente con Groq.
// La key vive en GROQ_API_KEY (Vercel), nunca en el navegador.
import { generateComponent } from '../server/generator.js';

const MODEL = 'llama-3.1-70b-versatile';

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
      // El cuerpo de error de Groq describe la causa (modelo, parámetros); no incluye la clave.
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
      // La salida del modelo no es confiable: un spec inválido es error del cliente de generación, no del servidor.
      return res.status(422).json({ error: err.message });
    }
    return res.status(200).json({ tag: out.tag, source: out.source });
  } catch (err) {
    console.error('generate failed', err?.name);
    return res.status(502).json({ error: 'Generation failed' });
  }
}
