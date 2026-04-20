import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(rootDir, "../dist");
const indexPath = path.join(distDir, "index.html");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

await access(indexPath);

const sendFile = async (response, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const fileStats = await stat(filePath);

  response.writeHead(200, {
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Length": fileStats.size,
    "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
  });

  createReadStream(filePath).pipe(response);
};

const server = createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400).end("Bad Request");
    return;
  }

  const requestUrl = new URL(request.url, "http://localhost");
  const normalizedPath = decodeURIComponent(requestUrl.pathname);
  const candidatePath = path.resolve(distDir, `.${normalizedPath}`);

  if (!candidatePath.startsWith(distDir)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const candidateStats = await stat(candidatePath);
    if (candidateStats.isFile()) {
      await sendFile(response, candidatePath);
      return;
    }
  } catch {
    // Fall back to the SPA entrypoint for client-routed URLs.
  }

  try {
    await sendFile(response, indexPath);
  } catch {
    response.writeHead(500).end("Internal Server Error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Faraway Atlas listening on http://0.0.0.0:${port}`);
});
