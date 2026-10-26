// Generador de componentes Lit con convenciones del equipo.
// Sin dependencias: se usa desde el servidor MCP, los tests y la demo.
// La salida no usa decoradores para poder ejecutarse directamente en el navegador.

export const PREFIX = 'forge';

const TYPES = ['string', 'number', 'boolean'];
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const RESERVED_PROPS = new Set(['constructor', 'render', 'styles', 'properties', 'shadowRoot']);

const toTagName = (name) =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toClassName = (tag) =>
  tag
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

// Escapa texto para usarlo dentro de un atributo HTML entre comillas dobles.
const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Escapa texto para usarlo dentro de un comentario JSDoc.
const escapeComment = (s) => String(s).replace(/\*\//g, '* /').replace(/\r?\n/g, ' ');

export const validateName = (name) => {
  if (typeof name !== 'string') return { ok: false, error: 'El nombre debe ser texto.' };
  const tag = toTagName(name);
  if (!tag.includes('-')) {
    return { ok: false, error: 'El nombre debe tener al menos dos palabras (los custom elements requieren guion).' };
  }
  if (!tag.startsWith(`${PREFIX}-`)) {
    return { ok: true, tag: `${PREFIX}-${tag}` };
  }
  return { ok: true, tag };
};

// Valida y normaliza una especificación. Lanza Error si algo no es seguro o válido.
// Se usa tanto para entradas MCP como para la salida del modelo (no confiable).
export const normalizeSpec = (spec) => {
  if (!spec || typeof spec !== 'object') throw new Error('La especificación debe ser un objeto.');

  const check = validateName(spec.name);
  if (!check.ok) throw new Error(check.error);

  const props = (spec.props || []).map((p) => {
    if (!p || typeof p !== 'object') throw new Error('Cada prop debe ser un objeto.');
    const name = p.name;
    if (typeof name !== 'string' || !CAMEL.test(name) || RESERVED_PROPS.has(name)) {
      throw new Error(`Nombre de prop inválido: ${String(name)} (usa camelCase).`);
    }
    const type = p.type ?? 'string';
    if (!TYPES.includes(type)) throw new Error(`Tipo de prop inválido: ${String(type)}.`);
    return { name, type, default: p.default };
  });

  const events = (spec.events || []).map((e) => {
    if (!e || typeof e !== 'object') throw new Error('Cada evento debe ser un objeto.');
    const name = typeof e.name === 'string' ? toTagName(e.name) : '';
    if (!KEBAB.test(name)) throw new Error(`Nombre de evento inválido: ${String(e.name)}.`);
    return { name, detail: typeof e.detail === 'string' ? e.detail : null };
  });

  const names = props.map((p) => p.name);
  if (new Set(names).size !== names.length) throw new Error('Hay props duplicadas.');
  const evNames = events.map((e) => e.name);
  if (new Set(evNames).size !== evNames.length) throw new Error('Hay eventos duplicados.');

  return {
    tag: check.tag,
    description: typeof spec.description === 'string' && spec.description.trim() ? spec.description.trim() : 'Componente generado.',
    props,
    events,
  };
};

// Convierte el default de una prop en un literal JS seguro según su tipo.
const literalFor = (prop) => {
  const { type, default: raw } = prop;
  if (type === 'number') {
    const n = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Default numérico inválido en ${prop.name}.`);
    return String(n);
  }
  if (type === 'boolean') {
    if (raw === undefined || raw === null || raw === '') return 'false';
    const v = raw === true || raw === 'true';
    return String(v);
  }
  return JSON.stringify(raw === undefined || raw === null ? '' : String(raw));
};

// spec: { name, description, props: [{name, type, default}], events: [{name, detail}] }
export const generateComponent = (input) => {
  const spec = normalizeSpec(input);
  const { tag, props, events } = spec;
  const cls = toClassName(tag);
  const description = escapeComment(spec.description);
  const label = escapeAttr(spec.description);

  // Los defaults van en el constructor: un campo de clase nativo sombrearía el accesor reactivo de Lit.
  const ctorBody = props.map((p) => `    this.${p.name} = ${literalFor(p)};`).join('\n');
  const ctor = props.length ? `  constructor() {\n    super();\n${ctorBody}\n  }\n\n` : '';

  const propOptions = props
    .map((p) => {
      const ctor = p.type === 'number' ? 'Number' : p.type === 'boolean' ? 'Boolean' : 'String';
      return `    ${p.name}: { type: ${ctor}, reflect: true },`;
    })
    .join('\n');

  const eventMethods = events
    .map((e) => {
      const method = `emit${toClassName(e.name)}`;
      const detailDoc = e.detail ? ` @param {*} detail ${escapeComment(e.detail)}` : ' @param {*} [detail]';
      return `  /**${detailDoc} */\n  ${method}(detail) {\n    this.dispatchEvent(new CustomEvent('${e.name}', { detail, bubbles: true, composed: true }));\n  }`;
    })
    .join('\n\n');

  const eventNotes = events.length ? `\n *\n * @fires ${events.map((e) => e.name).join(', ')}` : '';

  const source = `import { LitElement, html, css } from 'lit';

/**
 * ${description}${eventNotes}
 */
export class ${cls} extends LitElement {
  static styles = css\`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      color: var(--${tag}-text, #ededed);
    }
    :focus-visible {
      outline: 2px solid var(--${tag}-accent, #33ff99);
      outline-offset: 2px;
    }
  \`;

  static properties = {
${propOptions}
  };

${ctor}${eventMethods}${events.length ? '\n\n' : ''}  render() {
    return html\`
      <div role="region" aria-label="${label}">
        <slot></slot>
      </div>
    \`;
  }
}

if (!customElements.get('${tag}')) customElements.define('${tag}', ${cls});
`;

  return { tag, className: cls, file: `${tag}.js`, source };
};
