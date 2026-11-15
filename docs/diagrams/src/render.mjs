// Renders every diagram in diagrams.html to docs/diagrams/*.png at 2x.
// Optional tool (the PNGs are committed): npm i --no-save playwright && node docs/diagrams/src/render.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..");
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 1000 } });
await page.goto("file://" + path.join(here, "diagrams.html"));
await page.evaluate(() => document.fonts.ready);
for (const id of await page.$$eval(".fig", (els) => els.map((e) => e.id))) {
  await page.locator("#" + id).screenshot({ path: path.join(out, `${id}.png`) });
  console.log("rendered", id);
}
await browser.close();
