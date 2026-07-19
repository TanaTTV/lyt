import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8" };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    let target = resolve(root, `.${normalize(pathname)}`);
    if (!target.startsWith(root)) throw new Error("Invalid path");
    if ((await stat(target)).isDirectory()) target = join(target, "index.html");
    const body = await readFile(target);
    response.writeHead(200, { "content-type": types[extname(target)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    const body = await readFile(join(root, "404.html"));
    response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  }
}).listen(port, "127.0.0.1", () => console.log(`lyt site: http://127.0.0.1:${port}`));
