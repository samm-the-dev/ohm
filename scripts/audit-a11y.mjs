/**
 * Accessibility audit script — Playwright + axe-core
 *
 * Starts a Vite dev server, visits every page in both themes
 * (light + dark) at mobile and desktop widths, runs axe-core,
 * and outputs a JSON report.
 *
 * Usage:  npm run audit:a11y
 *    or:  node scripts/audit-a11y.mjs
 *
 * Prerequisites:
 *   npm install -D playwright @axe-core/playwright
 *   npx playwright install chromium
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'fs';
import { createServer } from 'vite';

// ─── CONFIGURATION ───────────────────────────────────────────
// Customize these for your project

const PORT = 5174;
const BASE = `http://localhost:${PORT}`;
const OUTPUT = process.env.CI ? 'axe-audit.json' : 'axe-audit.json';

// localStorage key for theme (set to null if not using theme toggle)
const THEME_KEY = null;

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
};

// Routes to audit (add your app's routes here)
const ROUTES = [{ path: '/', name: 'Board' }];

// ─── AUDIT LOGIC ─────────────────────────────────────────────

/** Run axe-core on the current page and return a clean result object. */
async function runAxe(page) {
  const results = await new AxeBuilder({ page }).analyze();
  return {
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodeCount: v.nodes.length,
      nodes: v.nodes.slice(0, 5).map((n) => ({
        target: n.target.join(' '),
        html: n.html.substring(0, 200),
        failureSummary: n.failureSummary,
      })),
    })),
    violationCount: results.violations.length,
    passCount: results.passes.length,
    incompleteCount: results.incomplete.length,
  };
}

function logResult(name, theme, viewport, result) {
  const icon = result.violationCount === 0 ? '\u2713' : '\u2717';
  console.log(
    `  ${icon} ${name} [${theme}, ${viewport}]: ` +
      `${result.violationCount} violations, ${result.passCount} passes`,
  );
}

// ─── KEYBOARD BEHAVIOR TESTS ────────────────────────────────

/** Run behavioral keyboard tests beyond what axe-core checks. */
async function runKeyboardTests(page, vpName) {
  const results = [];

  // 1. Skip-to-content link exists and targets #board
  {
    const link = await page.$('a.skip-to-content');
    const href = link ? await link.getAttribute('href') : null;
    const target = href ? await page.$(href) : null;
    const pass = !!link && !!target;
    results.push({ test: 'skip-to-content', pass, detail: href || 'missing' });
  }

  // 2. Heading hierarchy: h1 exists, h2s exist for columns
  {
    const h1 = await page.$('h1');
    const h2s = await page.$$('h2');
    const pass = !!h1 && h2s.length > 0;
    results.push({ test: 'heading-hierarchy', pass, detail: `h1: ${!!h1}, h2s: ${h2s.length}` });
  }

  // 3. Tab reaches interactive elements (nav links, buttons)
  {
    // Press Tab 15 times and collect focused element tag names
    const tags = new Set();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
      if (tag) tags.add(tag);
    }
    const pass = tags.has('button') || tags.has('a') || tags.has('input');
    results.push({
      test: 'tab-reaches-interactive',
      pass,
      detail: `Focused: ${[...tags].join(', ')}`,
    });
  }

  // 4. Escape closes dialogs (open settings, press Escape)
  if (vpName === 'desktop') {
    const settingsBtn = await page.$('button[aria-label="Settings"]:not([class*="hidden"])');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(300);
      const dialogBefore = await page.$('[role="dialog"]');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const dialogAfter = await page.$('[role="dialog"]');
      const pass = !!dialogBefore && !dialogAfter;
      results.push({ test: 'escape-closes-dialog', pass });
    }
  }

  // 5. Main landmark exists
  {
    const main = await page.$('main');
    const pass = !!main;
    results.push({ test: 'main-landmark', pass });
  }

  // 6. Nav landmark with label
  {
    const nav = await page.$('nav[aria-label]');
    const pass = !!nav;
    results.push({ test: 'nav-landmark', pass });
  }

  return results;
}

async function main() {
  // Start Vite dev server
  console.log('Starting Vite dev server...');
  const server = await createServer({
    server: { port: PORT, strictPort: true },
    logLevel: 'error',
  });
  await server.listen();
  console.log(`Dev server running at ${BASE}\n`);

  const browser = await chromium.launch();
  const allResults = [];
  const keyboardResults = [];

  const themes = THEME_KEY ? ['light', 'dark'] : ['default'];

  for (const theme of themes) {
    for (const [vpName, vpSize] of Object.entries(VIEWPORTS)) {
      console.log(`--- ${theme.toUpperCase()} / ${vpName.toUpperCase()} ---`);

      const context = await browser.newContext({ viewport: vpSize });
      const page = await context.newPage();

      // Pre-set theme in localStorage before any navigation
      if (THEME_KEY) {
        await page.addInitScript(
          ([key, value]) => localStorage.setItem(key, value),
          [THEME_KEY, theme],
        );
      }

      for (const route of ROUTES) {
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });

        // axe-core audit
        const result = await runAxe(page);
        allResults.push({
          page: route.name,
          path: route.path,
          theme,
          viewport: vpName,
          ...result,
        });
        logResult(route.name, theme, vpName, result);

        // Keyboard behavior tests (run once per viewport, default theme only)
        if (theme === themes[0]) {
          const kbResults = await runKeyboardTests(page, vpName);
          for (const kb of kbResults) {
            keyboardResults.push({ ...kb, viewport: vpName, page: route.name });
            const icon = kb.pass ? '\u2713' : '\u2717';
            console.log(`  ${icon} [keyboard] ${kb.test}${kb.detail ? ` (${kb.detail})` : ''}`);
          }
        }
      }

      await context.close();
    }
  }

  await browser.close();
  await server.close();

  // Write report
  const report = { axe: allResults, keyboard: keyboardResults };
  writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
  console.log(`\nResults written to ${OUTPUT}`);

  // Summary
  const totalViolations = allResults.reduce((sum, r) => sum + r.violationCount, 0);
  const uniqueIds = new Set(allResults.flatMap((r) => r.violations.map((v) => v.id)));
  const kbFails = keyboardResults.filter((r) => !r.pass).length;
  console.log(
    `\nSummary: ${allResults.length} axe audits, ` +
      `${totalViolations} total violations (${uniqueIds.size} unique rules), ` +
      `${keyboardResults.length} keyboard tests (${kbFails} failed)`,
  );

  if (uniqueIds.size > 0) {
    console.log('\nUnique violations across all pages:');
    for (const id of uniqueIds) {
      const affected = allResults.filter((r) => r.violations.some((v) => v.id === id));
      const first = affected[0].violations.find((v) => v.id === id);
      console.log(`  - ${id} (${first.impact}): ${first.help}`);
      console.log(
        `    Affected: ${affected.map((r) => `${r.page} [${r.theme}/${r.viewport}]`).join(', ')}`,
      );
    }
  }

  if (kbFails > 0) {
    console.log('\nFailed keyboard tests:');
    for (const kb of keyboardResults.filter((r) => !r.pass)) {
      console.log(`  - ${kb.test} [${kb.viewport}]${kb.detail ? `: ${kb.detail}` : ''}`);
    }
  }

  // Exit with error if any violations or keyboard failures found (for CI)
  return totalViolations > 0 || kbFails > 0 ? 1 : 0;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((e) => {
    console.error('Audit failed:', e);
    process.exit(1);
  });
