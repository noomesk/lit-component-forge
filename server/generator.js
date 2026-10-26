// Lit component generator conforming to team conventions.
// No external dependencies: used by MCP server, test suites, and front-end demo.
// Emits vanilla-compatible Lit elements (no experimental decorators) for universal browser execution.

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

const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeComment = (s) => String(s).replace(/\*\//g, '* /').replace(/\r?\n/g, ' ');

export const validateName = (name) => {
  if (typeof name !== 'string') return { ok: false, error: 'Name must be a string.' };
  const tag = toTagName(name);
  if (!tag.includes('-')) {
    return { ok: false, error: 'Name must consist of at least two words (custom elements require a hyphen).' };
  }
  if (!tag.startsWith(`${PREFIX}-`)) {
    return { ok: true, tag: `${PREFIX}-${tag}` };
  }
  return { ok: true, tag };
};

export const normalizeSpec = (spec) => {
  if (!spec || typeof spec !== 'object') throw new Error('Specification must be an object.');

  const check = validateName(spec.name);
  if (!check.ok) throw new Error(check.error);

  const props = (spec.props || []).map((p) => {
    if (!p || typeof p !== 'object') throw new Error('Each property must be an object.');
    const name = p.name;
    if (typeof name !== 'string' || !CAMEL.test(name) || RESERVED_PROPS.has(name)) {
      throw new Error(`Invalid property name: ${String(name)} (must be camelCase).`);
    }
    const type = p.type ?? 'string';
    if (!TYPES.includes(type)) throw new Error(`Invalid property type: ${String(type)}.`);
    return { name, type, default: p.default };
  });

  const events = (spec.events || []).map((e) => {
    if (!e || typeof e !== 'object') throw new Error('Each event must be an object.');
    const name = typeof e.name === 'string' ? toTagName(e.name) : '';
    if (!KEBAB.test(name)) throw new Error(`Invalid event name: ${String(e.name)}.`);
    return { name, detail: typeof e.detail === 'string' ? e.detail : null };
  });

  const names = props.map((p) => p.name);
  if (new Set(names).size !== names.length) throw new Error('Duplicate properties found.');
  const evNames = events.map((e) => e.name);
  if (new Set(evNames).size !== evNames.length) throw new Error('Duplicate events found.');

  return {
    tag: check.tag,
    description: typeof spec.description === 'string' && spec.description.trim() ? spec.description.trim() : 'Generated element.',
    props,
    events,
  };
};

const literalFor = (prop) => {
  const { type, default: raw } = prop;
  if (type === 'number') {
    const n = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Invalid numeric default for ${prop.name}.`);
    return String(n);
  }
  if (type === 'boolean') {
    if (raw === undefined || raw === null || raw === '') return 'false';
    const v = raw === true || raw === 'true';
    return String(v);
  }
  return JSON.stringify(raw === undefined || raw === null ? '' : String(raw));
};

export const generateComponent = (input) => {
  const spec = normalizeSpec(input);
  const { tag, props, events } = spec;
  const cls = toClassName(tag);
  const description = escapeComment(spec.description);
  const label = escapeAttr(spec.description);

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
      return `  /**${detailDoc} */\n  ${method}(detail) {\n    this.dispatchEvent(new CustomEvent('${e.name}', { detail: detail ?? null, bubbles: true, composed: true }));\n  }`;
    })
    .join('\n\n');

  const eventNotes = events.length ? `\n *\n * @fires ${events.map((e) => e.name).join(', ')}` : '';

  const renderPropsHtml = props.length
    ? `\n        <div class="props-grid">
${props.map((p) => `          <div class="prop-card">
            <span class="prop-name">${p.name}</span>
            <span class="prop-val">\${JSON.stringify(this.${p.name})}</span>
          </div>`).join('\n')}
        </div>`
    : '';

  const renderEventsHtml = events.length
    ? `\n        <div class="events-actions">
${events.map((e) => `          <button class="event-btn" @click=\${() => this.emit${toClassName(e.name)}(this.${props[0]?.name || 'undefined'})}>
            Emit "${e.name}"
          </button>`).join('\n')}
        </div>`
    : '';

  const source = `import { LitElement, html, css } from 'lit';

/**
 * ${description}${eventNotes}
 */
export class ${cls} extends LitElement {
  static styles = css\`
    :host {
      display: block;
      font-family: var(--forge-font-sans, system-ui, -apple-system, sans-serif);
      color: var(--${tag}-text, var(--forge-color-chalk, #e6e6e6));
      background-color: var(--${tag}-bg, var(--forge-color-surface, #0a0a0a));
      background-image: var(--forge-grain, url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E"));
      border-top: 1px solid var(--${tag}-border, var(--forge-color-line, #2a2a2a));
      padding: var(--forge-space-6, 1.5rem) var(--forge-space-4, 1rem);
      box-sizing: border-box;
      letter-spacing: -0.04em;
      line-height: 1.1;
    }
    h2, .title {
      font-size: clamp(1.8rem, 4vw, 3rem);
      font-weight: 900;
      line-height: 0.95;
      text-transform: uppercase;
      margin: 0 0 var(--forge-space-4, 1rem) 0;
      color: var(--forge-color-white, #fff);
      letter-spacing: -0.06em;
      transform: rotate(-0.5deg);
    }
    .meta {
      font-family: var(--forge-font-mono, monospace);
      font-size: 11px;
      color: var(--forge-color-ink, #8a8a8a);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: var(--forge-space-2, 0.4rem);
    }
    .layout-offset {
      margin-left: 10%;
      max-width: 85%;
      border-left: 2px solid var(--forge-color-line, #2a2a2a);
      padding-left: var(--forge-space-4, 1rem);
    }
    .props-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
      margin: var(--forge-space-4, 1rem) 0;
    }
    .prop-card {
      background: var(--forge-color-surface-2, #141414);
      border: 1px solid var(--forge-color-line, #2a2a2a);
      padding: 8px var(--forge-space-4, 1rem);
    }
    .prop-name {
      display: block;
      font-family: var(--forge-font-mono, monospace);
      font-size: 10px;
      color: var(--forge-color-ink, #8a8a8a);
      text-transform: uppercase;
    }
    .prop-val {
      font-size: 14px;
      font-weight: 700;
      color: var(--forge-color-white, #fff);
    }
    .events-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--forge-space-2, 0.4rem);
      margin: var(--forge-space-4, 1rem) 0;
    }
    .event-btn {
      background: transparent;
      border: 1px dashed var(--forge-color-ink, #8a8a8a);
      color: var(--forge-color-white, #fff);
      padding: 6px 12px;
      font-family: var(--forge-font-mono, monospace);
      font-size: 11px;
      text-transform: uppercase;
      cursor: pointer;
    }
    .event-btn:hover {
      border-style: solid;
      background: rgba(255, 255, 255, 0.05);
    }
    :focus-visible {
      outline: 1px solid var(--${tag}-accent, var(--forge-color-accent, #fff));
      outline-offset: 2px;
    }
  \`;

  static properties = {
${propOptions}
  };

${ctor}${eventMethods}${events.length ? '\n\n' : ''}  render() {
    return html\`
      <div role="region" aria-label="${label}">
        <div class="meta">${tag}</div>
        <h2 class="title">${label}</h2>${renderPropsHtml}${renderEventsHtml}
        <div class="layout-offset">
          <slot></slot>
        </div>
      </div>
    \`;
  }
}

if (!customElements.get('${tag}')) customElements.define('${tag}', ${cls});
`;

  return { tag, className: cls, file: `${tag}.js`, source };
};
