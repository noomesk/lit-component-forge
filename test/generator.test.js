import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent, validateName } from '../server/generator.js';

test('rechaza nombres sin guion', () => {
  assert.equal(validateName('boton').ok, false);
});

test('agrega el prefijo del equipo', () => {
  assert.equal(validateName('transfer card').tag, 'forge-transfer-card');
});

test('genera un componente con decoradores, props y eventos', () => {
  const out = generateComponent({
    name: 'transfer-card',
    description: 'Tarjeta de transferencia',
    props: [{ name: 'amount', type: 'number', default: '0' }],
    events: [{ name: 'transfer-submit' }],
  });
  assert.equal(out.tag, 'forge-transfer-card');
  assert.match(out.source, /@customElement\('forge-transfer-card'\)/);
  assert.match(out.source, /amount = 0/);
  assert.match(out.source, /'transfer-submit'/);
  assert.match(out.source, /composed: true/);
});

test('lanza error con nombre inválido', () => {
  assert.throws(() => generateComponent({ name: 'x' }));
});
