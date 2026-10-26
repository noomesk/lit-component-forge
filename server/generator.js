// Generador de componentes Lit con convenciones del equipo.
// Sin dependencias: se usa desde el servidor MCP, los tests y la demo.

const toTagName = (name) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toClassName = (tag) =>
  tag
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

// Convención: el prefijo del equipo evita choques con otros elementos.
export const PREFIX = 'forge';

export const validateName = (name) => {
  const tag = toTagName(name);
  if (!tag.includes('-')) {
    return { ok: false, error: 'El nombre debe tener al menos dos palabras (los custom elements requieren guion).' };
  }
  if (!tag.startsWith(`${PREFIX}-`)) {
    return { ok: true, tag: `${PREFIX}-${tag}` };
  }
  return { ok: true, tag };
};

// spec: { name, description, props: [{name, type, default}], events: [{name, detail}] }
export const generateComponent = (spec) => {
  const check = validateName(spec.name);
  if (!check.ok) throw new Error(check.error);

  const tag = check.tag;
  const cls = toClassName(tag);
  const props = spec.props || [];
  const events = spec.events || [];

  const propDecls = props
    .map((p) => `  @property({ type: ${p.type === 'number' ? 'Number' : p.type === 'boolean' ? 'Boolean' : 'String'}, reflect: true })\n  ${p.name} = ${p.default ?? (p.type === 'number' ? 0 : p.type === 'boolean' ? false : "''")};`)
    .join('\n\n');

  const eventMethods = events
    .map((e) => `  #emit${toClassName(e.name)}(detail) {\n    this.dispatchEvent(new CustomEvent('${e.name}', { detail, bubbles: true, composed: true }));\n  }`)
    .join('\n\n');

  const source = `import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * ${spec.description || 'Componente generado.'}
 *
 * @fires ${events.map((e) => e.name).join(', ') || '—'}
 */
@customElement('${tag}')
export class ${cls} extends LitElement {
  static styles = css\`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      color: var(--${tag}-text, #ededed);
    }
    :host :focus-visible {
      outline: 2px solid var(--${tag}-accent, #33ff99);
      outline-offset: 2px;
    }
  \`;

${propDecls}

${eventMethods}

  render() {
    return html\`
      <div role="region" aria-label="${spec.description || cls}">
        <slot></slot>
      </div>
    \`;
  }
}
`;

  return { tag, className: cls, file: `${tag}.js`, source };
};
