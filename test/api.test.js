import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/generate.js';

const realFetch = globalThis.fetch;
const realKey = process.env.GROQ_API_KEY;

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = realKey;
});

const mockRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};

const groqReply = (content) => async () => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

test('rechaza métodos distintos de POST', async () => {
  const res = mockRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
});

test('responde 500 si falta GROQ_API_KEY', async () => {
  delete process.env.GROQ_API_KEY;
  const res = mockRes();
  await handler({ method: 'POST', body: { prompt: 'x' } }, res);
  assert.equal(res.statusCode, 500);
});

test('valida el prompt (vacío o demasiado largo)', async () => {
  process.env.GROQ_API_KEY = 'test';
  for (const prompt of ['', '   ', 'a'.repeat(301), 42]) {
    const res = mockRes();
    await handler({ method: 'POST', body: { prompt } }, res);
    assert.equal(res.statusCode, 400, `prompt ${JSON.stringify(prompt)}`);
  }
});

test('genera el componente a partir de la respuesta del modelo', async () => {
  process.env.GROQ_API_KEY = 'test';
  let sent;
  globalThis.fetch = async (url, opts) => {
    sent = { url, opts };
    return groqReply(JSON.stringify({
      name: 'transfer-card',
      description: 'Tarjeta',
      props: [{ name: 'amount', type: 'number', default: '0' }],
      events: [{ name: 'transfer-submit' }],
    }))();
  };
  const res = mockRes();
  await handler({ method: 'POST', body: { prompt: 'tarjeta de transferencia' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tag, 'forge-transfer-card');
  assert.match(res.body.source, /customElements\.define\('forge-transfer-card'/);
  assert.equal(sent.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(sent.opts.headers.Authorization, 'Bearer test');
});

test('devuelve 502 si Groq responde con error, sin filtrar el cuerpo', async () => {
  process.env.GROQ_API_KEY = 'test';
  globalThis.fetch = async () => ({ ok: false, status: 429, text: async () => 'secret-detail' });
  const res = mockRes();
  await handler({ method: 'POST', body: { prompt: 'x' } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.stringify(res.body).includes('secret-detail'), false);
});

test('devuelve 502 si el modelo no devuelve JSON válido', async () => {
  process.env.GROQ_API_KEY = 'test';
  globalThis.fetch = groqReply('esto no es json');
  const res = mockRes();
  await handler({ method: 'POST', body: { prompt: 'x' } }, res);
  assert.equal(res.statusCode, 502);
});

test('devuelve 422 si el spec del modelo no pasa validación', async () => {
  process.env.GROQ_API_KEY = 'test';
  globalThis.fetch = groqReply(JSON.stringify({ name: 'boton' }));
  const res = mockRes();
  await handler({ method: 'POST', body: { prompt: 'x' } }, res);
  assert.equal(res.statusCode, 422);
});

test('devuelve 502 si la respuesta no tiene choices', async () => {
  process.env.GROQ_API_KEY = 'test';
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  const res = mockRes();
  await handler({ method: 'POST', body: { prompt: 'x' } }, res);
  assert.equal(res.statusCode, 502);
});
