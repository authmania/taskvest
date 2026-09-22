// TaskVest local dev server: serves the static site + the /api/resolve proxy.
// Run: node server.js   (then open http://localhost:4321)
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveAccount } from "./api/resolve.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".gif": "image/gif",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".eot": "application/vnd.ms-fontobject",
  ".mp3": "audio/mpeg", ".mpeg": "audio/mpeg", ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(u.pathname);

  if (pathname === "/api/resolve") {
    const out = await resolveAccount(u.searchParams.get("acc_no"), u.searchParams.get("bank"));
    res.writeHead(out.status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(out.body));
    return;
  }

  let filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    let stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (stat && stat.isDirectory()) { filePath = path.join(filePath, "index.html"); stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null; }
    if (!stat) {
      // clean URL fallback: /dashboard -> dashboard.html
      const alt = filePath + ".html";
      if (fs.existsSync(alt)) { filePath = alt; stat = fs.statSync(alt); }
    }
    if (!stat) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return; }
    var ext = path.extname(filePath).toLowerCase();
    var headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
    if (ext === ".html" || ext === ".js" || ext === ".json" || ext === ".webmanifest") {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(500); res.end("Server error");
  }
});

server.listen(PORT, () => {
  console.log(`TaskVest running at http://localhost:${PORT}  (with /api/resolve proxy)`);
});
