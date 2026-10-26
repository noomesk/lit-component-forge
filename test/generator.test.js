import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent, validateName } from '../server/generator.js';

test('rechaza nombres sin guion', () => {
  assert.equal(validateName('boton').ok, false);
});

test('agrega el prefijo del equipo', () => {
  assert.equal(validateName('transfer card').tag, 'forge-transfer-card');
});

test('genera un componente con props, eventos y registro sin decoradores', () => {
  const out = generateComponent({
    name: 'transfer-card',
    description: 'Tarjeta de transferencia',
    props: [{ name: 'amount', type: 'number', default: '0' }],
    events: [{ name: 'transfer-submit' }],
  });
  assert.equal(out.tag, 'forge-transfer-card');
  assert.match(out.source, /customElements\.define\('forge-transfer-card', ForgeTransferCard\)/);
  assert.match(out.source, /amount: \{ type: Number, reflect: true \}/);
  assert.match(out.source, /this\.amount = 0;/);
  assert.match(out.source, /'transfer-submit'/);
  assert.match(out.source, /composed: true/);
  assert.doesNotMatch(out.source, /@customElement|@property/);
});

test('escapa defaults de string y los convierte en literal JS válido', () => {
  const out = generateComponent({
    name: 'demo-x',
    props: [{ name: 'label', type: 'string', default: 'di "hola"\n</script>' }],
  });
  assert.match(out.source, /this\.label = "di \\"hola\\"\\n<\/script>";/);
});

test('booleanos por defecto son false salvo que se indique true', () => {
  const out = generateComponent({
    name: 'demo-flag',
    props: [{ name: 'open', type: 'boolean' }, { name: 'on', type: 'boolean', default: 'true' }],
  });
  assert.match(out.source, /this\.open = false;/);
  assert.match(out.source, /this\.on = true;/);
});

test('rechaza default numérico no finito', () => {
  assert.throws(() => generateComponent({ name: 'demo-n', props: [{ name: 'n', type: 'number', default: 'NaN' }] }), /Default numérico/);
});

test('rechaza nombres de prop que no son camelCase o son reservados', () => {
  assert.throws(() => generateComponent({ name: 'demo-p', props: [{ name: 'Bad-Name' }] }), /Nombre de prop inválido/);
  assert.throws(() => generateComponent({ name: 'demo-p', props: [{ name: 'render' }] }), /Nombre de prop inválido/);
});

test('rechaza tipos de prop fuera de la lista permitida', () => {
  assert.throws(() => generateComponent({ name: 'demo-t', props: [{ name: 'a', type: 'object' }] }), /Tipo de prop inválido/);
});

test('rechaza nombres de evento inválidos y duplicados', () => {
  assert.throws(() => generateComponent({ name: 'demo-e', events: [{ name: '---' }] }), /Nombre de evento inválido/);
  assert.throws(() => generateComponent({ name: 'demo-e', events: [{ name: 'ok-ev' }, { name: 'ok-ev' }] }), /duplicados/);
});

test('escapa la descripción dentro del atributo aria-label y del comentario', () => {
  const out = generateComponent({ name: 'demo-d', description: 'Hola "x" </div> */ fin' });
  assert.match(out.source, /aria-label="Hola &quot;x&quot; &lt;\/div&gt; \*\/ fin"/);
  assert.doesNotMatch(out.source, /\*\/ fin\n \*\//);
});

test('lanza error con nombre inválido', () => {
  assert.throws(() => generateComponent({ name: 'x' }));
});

test('el código generado es JavaScript válido', async () => {
  const { writeFileSync, rmSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'forge-'));
  const out = generateComponent({
    name: 'syntax-check',
    props: [{ name: 'label', type: 'string', default: 'x' }],
    events: [{ name: 'do-thing' }],
  });
  const file = join(dir, 'c.mjs');
  writeFileSync(file, out.source);
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
