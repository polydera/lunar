// Render OG images from og-template.html into public/img/.
// Usage: node scripts/og/render-og.mjs
// Requires puppeteer (ad-hoc): npx -y -p puppeteer@latest node scripts/og/render-og.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const template = pathToFileURL(resolve(here, 'og-template.html')).href;
const outDir = resolve(repoRoot, 'public', 'img');

const puppeteerPath = process.env.PUPPETEER_PATH || 'puppeteer';
const { default: puppeteer } = await import(puppeteerPath);

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

async function shoot(variant, width, height, outName) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  const url = variant ? `${template}?variant=${variant}` : template;
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const el = await page.$('#canvas');
  const out = resolve(outDir, outName);
  await el.screenshot({ path: out, omitBackground: false });
  console.log(`wrote ${out}`);
  await page.close();
}

await shoot(null,      1200, 630, 'og-preview.png');
await shoot('twitter', 1200, 675, 'twitter-card.png');

await browser.close();
