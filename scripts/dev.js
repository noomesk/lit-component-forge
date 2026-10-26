// Servidor local para probar la demo y /api/generate sin Vercel.
// Uso: GROQ_API_KEY=... node scripts/dev.js  (puerto: PORT, por defecto 3000)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import generate from '../api/generate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 3000;

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 10_000) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/generate') {
    const body = req.method === 'POST' ? await readBody(req).catch(() => ({})) : undefined;
    const shim = {
      status(code) {
        res.statusCode = code;
        return this;
      },
      json(payload) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
        return this;
      },
    };
    return generate({ method: req.method, body }, shim);
  }

  const file = url.pathname === '/' ? 'index.html' : null;
  if (!file) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  const html = await readFile(join(root, file));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
});

server.listen(port, () => {
  console.log(`Demo local: http://localhost:${port}`);
  console.log(process.env.GROQ_API_KEY ? 'GROQ_API_KEY: presente' : 'GROQ_API_KEY: AUSENTE');
});
