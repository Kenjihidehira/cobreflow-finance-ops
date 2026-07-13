import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAutomationQueue,
  buildSummary,
  enrichReceivables,
  filterReceivables,
  loadData,
  reconcilePayments
} from "./core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT || 3000);
const today = process.env.DEMO_TODAY || "2026-07-08";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload muito grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Proibido");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Nao encontrado");
      return;
    }

    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  });
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      if (url.pathname === "/api/health") {
        return sendJson(res, 200, { ok: true, service: "cobreflow-finance-ops", today });
      }

      if (url.pathname === "/api/summary") {
        const data = loadData();
        return sendJson(res, 200, buildSummary(data, today));
      }

      if (url.pathname === "/api/receivables") {
        const data = loadData();
        const enriched = enrichReceivables(data.receivables, today);
        const filtered = filterReceivables(enriched, {
          status: url.searchParams.get("status") || "all",
          channel: url.searchParams.get("channel") || "all",
          search: url.searchParams.get("search") || ""
        });

        return sendJson(res, 200, {
          count: filtered.length,
          total: enriched.length,
          receivables: filtered
        });
      }

      if (url.pathname === "/api/automations") {
        const data = loadData();
        return sendJson(res, 200, {
          rules: data.automationRules,
          queue: buildAutomationQueue(data, today)
        });
      }

      if (url.pathname === "/api/reconcile" && req.method === "POST") {
        const data = loadData();
        const reconciled = reconcilePayments(data);
        return sendJson(res, 200, {
          actions: reconciled.reconciliationActions || [],
          summary: buildSummary(reconciled, today)
        });
      }

      if (url.pathname === "/api/reminders/run" && req.method === "POST") {
        const body = await parseBody(req);
        const data = loadData();
        const limit = Number(body.limit || 3);
        const queue = buildAutomationQueue(data, today).slice(0, limit);

        return sendJson(res, 200, {
          sent: queue.length,
          items: queue.map((item) => ({
            invoiceId: item.invoiceId,
            customer: item.customer,
            channel: item.channel,
            message: `${item.action}: ${item.customer} - ${item.reason} - ${item.balance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
          }))
        });
      }

      if (url.pathname.startsWith("/api/")) {
        return sendJson(res, 404, { error: "Endpoint nao encontrado" });
      }

      return serveStatic(req, res);
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(port, () => {
    console.log(`CobreFlow rodando em http://localhost:${port}`);
  });
}
