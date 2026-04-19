/**
 * Minimal HTTP gateway for Render: /health, JSON-RPC POST / and /rpc → Anvil :8545.
 * Extend with a JSON-RPC method allow-list before any public demo.
 */
import http from "node:http";
import { request as httpRequest } from "node:http";

const port = Number(process.env.PORT ?? "10000");
const anvil = process.env.ANVIL_RPC ?? "http://127.0.0.1:8545";

function proxyToAnvil(req, res, bodyBuf) {
  const u = new URL(anvil);
  const port =
    u.port !== ""
      ? Number(u.port)
      : u.protocol === "https:"
        ? 443
        : 80;
  const opts = {
    hostname: u.hostname,
    port,
    path: "/",
    method: req.method,
    headers: { ...req.headers, host: `${u.hostname}:${port}` },
  };
  const p = httpRequest(opts, (ar) => {
    res.writeHead(ar.statusCode ?? 502, ar.headers);
    ar.pipe(res);
  });
  p.on("error", () => {
    res.writeHead(502);
    res.end("anvil unreachable");
  });
  p.end(bodyBuf);
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if ((req.url === "/" || req.url?.startsWith("/rpc")) && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      proxyToAnvil(req, res, body);
    });
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("use POST / or /rpc for JSON-RPC, GET /health");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[gateway] listening :${port} → ${anvil}`);
});
