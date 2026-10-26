import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent, validateName } from '../server/generator.js';

test('rejects names without hyphens', () => {
  assert.equal(validateName('button').ok, false);
});

test('adds the team prefix', () => {
  assert.equal(validateName('transfer card').tag, 'forge-transfer-card');
});

test('generates a component with props, events, and registration', () => {
  const out = generateComponent({
    name: 'transfer-card',
    description: 'Transfer card',
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

test('escapes string defaults and creates valid JS literals', () => {
  const out = generateComponent({
    name: 'demo-x',
    props: [{ name: 'label', type: 'string', default: 'say "hello"\n</script>' }],
  });
  assert.match(out.source, /this\.label = "say \\"hello\\"\\n<\/script>";/);
});

test('booleans default to false unless true is specified', () => {
  const out = generateComponent({
    name: 'demo-flag',
    props: [{ name: 'open', type: 'boolean' }, { name: 'on', type: 'boolean', default: 'true' }],
  });
  assert.match(out.source, /this\.open = false;/);
  assert.match(out.source, /this\.on = true;/);
});

test('rejects invalid non-finite numeric defaults', () => {
  assert.throws(() => generateComponent({ name: 'demo-n', props: [{ name: 'n', type: 'number', default: 'NaN' }] }), /Invalid numeric default/);
});

test('rejects non-camelCase or reserved property names', () => {
  assert.throws(() => generateComponent({ name: 'demo-p', props: [{ name: 'Bad-Name' }] }), /Invalid property name/);
  assert.throws(() => generateComponent({ name: 'demo-p', props: [{ name: 'render' }] }), /Invalid property name/);
});

test('rejects property types outside the allowed list', () => {
  assert.throws(() => generateComponent({ name: 'demo-t', props: [{ name: 'a', type: 'object' }] }), /Invalid property type/);
});

test('rejects invalid or duplicate event names', () => {
  assert.throws(() => generateComponent({ name: 'demo-e', events: [{ name: '---' }] }), /Invalid event name/);
  assert.throws(() => generateComponent({ name: 'demo-e', events: [{ name: 'ok-ev' }, { name: 'ok-ev' }] }), /Duplicate/);
});

test('escapes description in aria-label attribute and comments', () => {
  const out = generateComponent({ name: 'demo-d', description: 'Hello "x" </div> */ end' });
  assert.match(out.source, /aria-label="Hello &quot;x&quot; &lt;\/div&gt; \*\/ end"/);
  assert.doesNotMatch(out.source, /\*\/ end\n \*\//);
});

test('throws on invalid name', () => {
  assert.throws(() => generateComponent({ name: 'x' }));
});

test('generated code is valid JavaScript syntax', async () => {
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
