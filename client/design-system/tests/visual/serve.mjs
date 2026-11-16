// Serves the static Storybook build for the screenshot tests: node tests/visual/serve.mjs [port].
// No dependencies, so it runs the same on a laptop and inside the Playwright image.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../storybook-static");
const PORT = Number(process.argv[2] ?? 6107);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    await stat(file);
  } catch {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(PORT, () => console.log(`Serving ${ROOT} on http://localhost:${PORT}`));
