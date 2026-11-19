// Real-browser end-to-end test: two users, two isolated browser contexts, the real UI.
//
//   1. start the app:        npm run dev   (or build + start)
//   2. run this script:      npm run test:e2e
//
// Browser: uses your installed Google Chrome by default (channel "chrome").
// Override with E2E_BROWSER_PATH=/path/to/chrome (and optionally E2E_BROWSER_ARGS='["--no-sandbox"]').
// Screenshots are written to docs/screenshots.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`  ✓ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message ?? e).split("\n")[0] });
    console.log(`  ✗ ${name}\n      ${String(e.message ?? e).split("\n")[0]}`);
    throw e;
  }
}

const launchOpts = process.env.E2E_BROWSER_PATH
  ? { executablePath: process.env.E2E_BROWSER_PATH, args: JSON.parse(process.env.E2E_BROWSER_ARGS ?? "[]"), headless: true }
  : { channel: "chrome", headless: true };

const stamp = Date.now();
const PASSWORD = "E2e-Passw0rd!";
const alice = { name: "Alice Anderson", email: `alice.${stamp}@example.test` };
const bob = { name: "Bob Builder", email: `bob.${stamp}@example.test` };

async function register(page, u) {
  await page.goto(`${BASE}/register`);
  await page.getByLabel("Full name").fill(u.name);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
}
// Remote cursor labels live inside the editor DOM, so strip them before comparing document text.
const PM_TEXT = () => {
  const clone = document.querySelector(".ProseMirror")?.cloneNode(true);
  if (!clone) return "";
  clone.querySelectorAll(".collaboration-cursor__caret, .ProseMirror-trailingBreak").forEach((n) => n.remove());
  return clone.textContent ?? "";
};
const editorText = (page) => page.evaluate(PM_TEXT);
const waitText = (page, text, timeout = 10000) =>
  page.waitForFunction(`(${PM_TEXT.toString()})().includes(${JSON.stringify(text)})`, null, { timeout });
const waitNoText = (page, text, timeout = 10000) =>
  page.waitForFunction(`!(${PM_TEXT.toString()})().includes(${JSON.stringify(text)})`, null, { timeout });

const browser = await chromium.launch(launchOpts);
const ctxA = await browser.newContext({ viewport: { width: 1360, height: 860 } });
const ctxB = await browser.newContext({ viewport: { width: 1360, height: 860 } });
const A = await ctxA.newPage();
const B = await ctxB.newPage();
for (const [p, n] of [[A, "Alice"], [B, "Bob"]]) {
  p.on("pageerror", (e) => console.log(`  [${n} page error]`, e.message));
}

let wsUrl, docUrl;
try {
  console.log("Browser E2E against", BASE);

  await step("Route guard redirects anonymous users to /login", async () => {
    const p = await ctxA.newPage();
    await p.goto(`${BASE}/dashboard`);
    await p.waitForURL("**/login**");
    await p.close();
  });

  await step("Alice registers and lands on the dashboard", async () => {
    await register(A, alice);
    await A.getByText("Create your first workspace").waitFor();
    await A.screenshot({ path: `${SHOTS}/01-dashboard-empty.png` });
  });

  await step("Bob registers in a separate browser session", async () => {
    await register(B, bob);
  });

  await step("Alice creates a workspace", async () => {
    await A.getByRole("button", { name: "New workspace" }).first().click();
    await A.getByLabel("Name").fill("Launch Team");
    await A.getByRole("button", { name: "Create workspace" }).click();
    await A.waitForURL(/\/w\/[^/]+$/);
    wsUrl = A.url();
    await A.getByRole("heading", { name: "Launch Team" }).waitFor();
  });

  await step("Alice invites Bob as editor from workspace settings", async () => {
    let t0 = Date.now();
    const lap = (l) => { if (process.env.E2E_DEBUG) console.log(`      [${l}] ${Date.now() - t0} ms`); t0 = Date.now(); };
    await A.goto(`${wsUrl}/settings`);
    lap("goto settings");
    await A.getByLabel("Invite by email").fill(bob.email);
    lap("fill email");
    await A.getByRole("button", { name: "Invite" }).click();
    lap("click invite");
    await A.getByText(bob.name).waitFor();
    lap("member listed");
    await A.screenshot({ path: `${SHOTS}/02-workspace-settings.png` });
  });

  await step("Alice creates a page and types into the rich-text editor", async () => {
    await A.goto(wsUrl);
    await A.getByRole("button", { name: "New page" }).first().click();
    await A.waitForURL(/\/d\//);
    docUrl = A.url();
    await A.getByLabel("Page title").fill("Launch plan");
    await A.locator(".ProseMirror").click();
    await A.keyboard.type("Alice was here.");
    await A.getByText("Saved").first().waitFor({ timeout: 10000 });
  });

  await step("Bob opens the page and sees Alice's text without refreshing", async () => {
    await B.goto(docUrl);
    await waitText(B, "Alice was here.");
  });

  await step("Bob's edit appears live on Alice's screen (and vice versa)", async () => {
    await B.locator(".ProseMirror").click();
    await B.keyboard.press("Control+End");
    await B.keyboard.press("Enter");
    await B.keyboard.type("Bob was here.");
    await waitText(A, "Bob was here.");
    await A.locator(".ProseMirror").click();
    await A.keyboard.press("Control+End");
    await A.keyboard.press("Enter");
    await A.keyboard.type("Second line from Alice.");
    await waitText(B, "Second line from Alice.");
  });

  await step("Concurrent typing in both browsers converges without losing text", async () => {
    // both users type at the same time into the same document
    await Promise.all([
      (async () => { await A.locator(".ProseMirror").click(); await A.keyboard.press("Control+Home"); await A.keyboard.type("AAAA-", { delay: 20 }); })(),
      (async () => { await B.locator(".ProseMirror").click(); await B.keyboard.press("Control+End"); await B.keyboard.type(" -BBBB", { delay: 20 }); })(),
    ]);
    await waitText(A, "-BBBB");
    await waitText(B, "AAAA-");
    await A.waitForTimeout(800);
    const a = await editorText(A), b = await editorText(B);
    if (a !== b) throw new Error(`documents diverged:\nA=${JSON.stringify(a)}\nB=${JSON.stringify(b)}`);
    for (const s of ["AAAA-", "Alice was here.", "Bob was here.", "Second line from Alice.", "-BBBB"]) if (!a.includes(s)) throw new Error("lost text: " + s);
  });

  await step("Live presence: Bob's coloured cursor + avatar are visible to Alice", async () => {
    await B.locator(".ProseMirror").click();
    await B.keyboard.type(" ");
    await A.locator(".collaboration-cursor__label", { hasText: "Bob Builder" }).first().waitFor({ timeout: 10000 });
    await A.locator('[aria-label="People viewing this page"] [title^="Bob Builder"]').first().waitFor();
    await A.screenshot({ path: `${SHOTS}/03-editor-live-cursors.png` });
  });

  await step("Rich-text formatting (heading, bold, list) works and syncs", async () => {
    await A.locator(".ProseMirror").click();
    await A.keyboard.press("Control+End");
    await A.keyboard.press("Enter");
    await A.getByRole("button", { name: "Heading 2" }).click();
    await A.keyboard.type("Milestones");
    await A.keyboard.press("Enter");
    await A.getByRole("button", { name: "Bulleted list" }).click();
    await A.keyboard.type("Ship beta");
    await B.locator(".ProseMirror h2", { hasText: "Milestones" }).waitFor();
    await B.locator(".ProseMirror ul li", { hasText: "Ship beta" }).waitFor();
  });

  await step("Alice adds a comment; Bob sees it appear live and replies", async () => {
    await A.getByRole("button", { name: /Comments/ }).click();
    await B.getByRole("button", { name: /Comments/ }).click();
    await A.getByLabel("New comment").fill("Can we confirm the beta date?");
    await A.getByRole("button", { name: "Comment", exact: true }).click();
    await B.getByText("Can we confirm the beta date?").waitFor({ timeout: 10000 });
    await B.getByRole("button", { name: "Reply" }).first().click();
    await B.getByLabel("Reply").fill("Yes - Nov 28.");
    await B.getByRole("button", { name: "Reply", exact: true }).last().click();
    await A.getByText("Yes - Nov 28.").waitFor({ timeout: 10000 });
    await A.screenshot({ path: `${SHOTS}/04-comments.png` });
  });

  await step("Document persists after a full page refresh", async () => {
    await A.waitForTimeout(800);
    await A.reload();
    await waitText(A, "Alice was here.");
    await waitText(A, "Milestones");
  });

  await step("Version history: save a snapshot, edit, then restore it", async () => {
    await A.getByRole("button", { name: /History/ }).click();
    await A.getByLabel("Version name").fill("Before cleanup");
    await A.getByRole("button", { name: "Save", exact: true }).click();
    await A.getByText("Before cleanup").first().waitFor();
    await A.locator(".ProseMirror").click();
    await A.keyboard.press("Control+End");
    await A.keyboard.type(" TEMPORARY-JUNK");
    await waitText(B, "TEMPORARY-JUNK");
    await A.getByText("Before cleanup").first().click();
    await A.getByRole("button", { name: "Restore this version" }).click();
    await waitNoText(A, "TEMPORARY-JUNK");
    await waitNoText(B, "TEMPORARY-JUNK");
    await waitText(B, "Alice was here.");
    await A.screenshot({ path: `${SHOTS}/05-version-history.png` });
  });

  await step("Permissions: demoting Bob to viewer makes his editor read-only live", async () => {
    const C = await ctxA.newPage();
    await C.goto(`${wsUrl}/settings`);
    await C.getByLabel(`Role for ${bob.name}`).selectOption("VIEWER");
    await B.waitForSelector('.ProseMirror[contenteditable="false"]', { timeout: 15000 });
    await B.getByText("View only").waitFor();
    const before = await editorText(A);
    await B.locator(".ProseMirror").click();
    await B.keyboard.type("SHOULD-NOT-APPEAR");
    await A.waitForTimeout(1000);
    if ((await editorText(A)).includes("SHOULD-NOT-APPEAR")) throw new Error("viewer was able to edit");
    if ((await editorText(A)) !== before) throw new Error("document changed unexpectedly");
    await B.screenshot({ path: `${SHOTS}/06-viewer-read-only.png` });
    await C.close();
  });

  await step("Responsive: editor is usable on a phone-sized viewport", async () => {
    const M = await ctxA.newPage();
    await M.setViewportSize({ width: 390, height: 800 });
    await M.goto(docUrl);
    await waitText(M, "Alice was here.");
    const overflow = await M.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) throw new Error("horizontal overflow on mobile");
    await M.screenshot({ path: `${SHOTS}/07-mobile-editor.png` });
    await M.close();
  });

  await step("Logout ends the session and re-protects routes", async () => {
    await A.getByRole("button", { name: "Sign out" }).click();
    await A.waitForURL("**/login**");
    await A.goto(`${BASE}/dashboard`);
    await A.waitForURL("**/login**");
  });
} catch {
  process.exitCode = 1;
} finally {
  await browser.close();
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} browser steps passed`);
  if (ok !== results.length) process.exitCode = 1;
}
