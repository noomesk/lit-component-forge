# lit-component-forge

Servidor MCP que genera componentes Lit siguiendo convenciones de equipo, con una demo web que usa Groq.

Hecho con Lit, Shadow DOM y Model Context Protocol. Construido solo con documentación pública.

## Qué incluye

- **Servidor MCP** (`server/index.js`) con herramientas `validate_component_name` y `generate_component`, y un recurso `forge://conventions`.
- **Generador** (`server/generator.js`): crea componentes con `@customElement`, props reactivas, eventos con `bubbles` y `composed`, y estilos con variables CSS.
- **Demo** (`index.html` + `api/generate.js`): describes un componente, Groq lo convierte en especificación y la página muestra el código y una vista previa.

## Uso

```bash
npm install
npm test
npm run mcp   # servidor MCP por stdio
```

Para la demo, configura `GROQ_API_KEY` en Vercel.

## Conectar con un host MCP

```json
{
  "mcpServers": {
    "lit-component-forge": {
      "command": "node",
      "args": ["/ruta/a/lit-component-forge/server/index.js"]
    }
  }
}
```

## Licencia

MIT
