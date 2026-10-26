#!/usr/bin/env node
// Servidor MCP: expone generación de componentes Lit y las convenciones del equipo.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateComponent, validateName, PREFIX } from './generator.js';

const CONVENTIONS = `# Convenciones de componentes Lit
- Tag con prefijo "${PREFIX}-" y al menos un guion.
- Shadow DOM siempre (LitElement por defecto).
- Propiedades públicas con @property y reflect cuando afecten el estilo.
- Eventos personalizados con bubbles y composed, nombrados en kebab-case (ej. transfer-submit).
- Accesibilidad: roles ARIA, labels asociados, foco visible, navegación por teclado.
- Estilos con variables CSS (--${PREFIX}-*) para permitir temas.
- Un test de render por componente.`;

const server = new McpServer({ name: 'lit-component-forge', version: '0.1.0' });

server.tool(
  'validate_component_name',
  'Valida y normaliza el nombre de un componente Lit según las convenciones',
  { name: z.string().min(1) },
  async ({ name }) => ({
    content: [{ type: 'text', text: JSON.stringify(validateName(name)) }],
  }),
);

server.tool(
  'generate_component',
  'Genera el código de un componente Lit a partir de una especificación',
  {
    name: z.string().min(1),
    description: z.string().optional(),
    props: z
      .array(z.object({ name: z.string(), type: z.enum(['string', 'number', 'boolean']), default: z.string().optional() }))
      .optional(),
    events: z.array(z.object({ name: z.string(), detail: z.string().optional() })).optional(),
  },
  async (spec) => {
    const out = generateComponent(spec);
    return { content: [{ type: 'text', text: out.source }] };
  },
);

server.resource('conventions', 'forge://conventions', { mimeType: 'text/markdown' }, async () => ({
  contents: [{ uri: 'forge://conventions', mimeType: 'text/markdown', text: CONVENTIONS }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
