import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/demo/index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../public/demo/app.js", import.meta.url), "utf8");

test("a carteira oferece ordenacao, limpeza e navegacao funcional", () => {
  for (const id of ["sortFilter", "clearFilters", "receivables", "automation", "metrics"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(script, /Nenhum recebivel encontrado/);
  assert.doesNotMatch(html, /<button class="nav-item"/);
});

test("a demo nao usa persistencia local no navegador", () => {
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
});
