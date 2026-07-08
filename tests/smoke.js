import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "../src/server.js";

const requiredFiles = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "data/seed.json",
  "README.md"
];

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(new URL(`../${file}`, import.meta.url)), `${file} ausente`);
}

const server = createServer();
const port = await new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.ok, true);

  const html = await fetch(baseUrl).then((response) => response.text());
  assert.ok(html.includes("CobreFlow Finance Ops"));
  assert.ok(html.includes("Rodar automacao"));

  const receivables = await fetch(`${baseUrl}/api/receivables`).then((response) => response.json());
  assert.ok(receivables.count >= 10);

  console.log("Smoke test OK: app, API e seed respondem corretamente.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
