/* global console, process */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const OUT = process.env.OUT_DIR ?? '/tmp/opencode/phase10-5-playthrough';
await fs.mkdir(OUT, { recursive: true });

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const notes = [];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  notes.push(line);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`screenshot: ${file}`);
}

async function maybeClick(page, text, opts = {}) {
  try {
    const loc = page.getByRole(opts.role ?? 'button', { name: text, exact: opts.exact ?? false }).first();
    if (await loc.isVisible({ timeout: opts.timeout ?? 1500 })) {
      await loc.click();
      log(`clicked(optional): ${text}`);
      return true;
    }
  } catch {
    // optional action
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    try {
      // eslint-disable-next-line no-undef
      localStorage.clear();
      // eslint-disable-next-line no-undef
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('requestfailed', (r) => failedRequests.push(`${r.failure()?.errorText} ${r.url()}`));

  try {
    log(`navigate ${BASE}`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, '01-load');

    // Dismiss onboarding/help if present
    await maybeClick(page, 'Got it — dismiss', { timeout: 2000 });
    await maybeClick(page, 'Dismiss guide', { timeout: 1000 });
    await maybeClick(page, 'Close help', { timeout: 1000 });
    await shot(page, '02-after-help');

    // Basic smoke: heading and key controls
    await page.getByRole('heading', { name: /THE BAR/i }).waitFor({ timeout: 10000 });
    log('heading visible');

    // Go through assignments by following objective panel buttons
    for (let step = 0; step < 80; step++) {
      await page.waitForTimeout(400);
      const body = await page.content();
      if (/Chapter complete|First brief complete|Junior Advocate/i.test(body) && /Start a new game/i.test(body)) {
        log('completion screen detected');
        await shot(page, '99-complete');
        break;
      }

      // Try to click primary action buttons in a sensible order
      const actions = [
        'Submit / Evaluate',
        'Submit draft for feedback',
        'Submit for senior review',
        'Submit final brief',
        'Open draft & submit →',
        'Senior review & revision →',
        'Final brief submission →',
        'Save draft version',
        'Save draft',
        'Save note',
        'Save connection',
        'Record observation',
        'Record challenge',
        'Add to theory',
        'Accept case',
      ];
      let acted = false;
      for (const a of actions) {
        if (await maybeClick(page, a, { timeout: 450 })) {
          acted = true;
          break;
        }
      }

      // Fill obvious textareas if visible and empty
      const textareas = page.locator('textarea:visible');
      const count = await textareas.count();
      for (let i = 0; i < Math.min(count, 3); i++) {
        const ta = textareas.nth(i);
        const val = await ta.inputValue().catch(() => '');
        if (!val || val.length < 20) {
          await ta
            .fill(
              'I reviewed the available record, separated known facts from claims, noted disputed points, and relied only on reviewed evidence and verified sources. I do not assert fault as a proven fact.',
            )
            .catch(() => {});
          log('filled textarea');
          acted = true;
        }
      }

      // Discover/review evidence buttons
      const discover = page.getByRole('button', { name: /Inspect \/ Discover/i }).first();
      if (await discover.isVisible().catch(() => false)) {
        await discover.click().catch(() => {});
        log('discovered evidence');
        acted = true;
      }
      const review = page.getByRole('button', { name: /^Mark reviewed$/i }).first();
      if (await review.isVisible().catch(() => false)) {
        await review.click().catch(() => {});
        log('reviewed evidence');
        acted = true;
      }

      if (!acted) {
        const panels = [
          'Assignments',
          'Evidence',
          'Case Theory',
          'Research',
          'Draft',
          'Casework',
          'Journal',
          'Notebook',
        ];
        for (const p of panels) {
          if (await maybeClick(page, p, { timeout: 300 })) {
            acted = true;
            break;
          }
        }
      }
      if (!acted) {
        await maybeClick(page, 'Advance time', { timeout: 400 });
      }

      if (step % 10 === 0) await shot(page, `step-${String(step).padStart(2, '0')}`);
    }

    await shot(page, 'final');

    // Persistence check: reload
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, 'after-reload');
    log('reload complete');
  } finally {
    await browser.close().catch(() => {});
  }

  const report = {
    base: BASE,
    consoleErrors,
    pageErrors,
    failedRequests,
    notes,
  };
  await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: pageErrors.length === 0,
        consoleErrors: consoleErrors.length,
        failedRequests: failedRequests.length,
        out: OUT,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
