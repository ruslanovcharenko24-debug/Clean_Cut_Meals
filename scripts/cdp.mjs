// Minimal Chrome DevTools Protocol driver (no dependencies).
// Usage: node cdp.mjs <outDir> <jsonSteps>
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const outDir = process.argv[2];
const steps = JSON.parse(process.argv[3]);

const profile = mkdtempSync(join(tmpdir(), 'ccm-cdp-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
  } catch { await sleep(200); }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) events.push(m);
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: { result: { value: `TIMEOUT ${method}` } } }); }, 15000); pending.set(i, (m) => { clearTimeout(t); res(m); }); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: process.env.CDP_ORIGIN || 'http://localhost:4321' });

const results = [];
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true, timeout: 10000 });
  return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description;
};
for (const s of steps) {
  if (s.viewport) await send('Emulation.setDeviceMetricsOverride', { width: s.viewport[0], height: s.viewport[1], deviceScaleFactor: 2, mobile: true });
  if (s.net) { await send("Network.enable"); await send("Network.emulateNetworkConditions", s.net); await send("Emulation.setCPUThrottlingRate", { rate: s.cpu || 1 }); }
  if (s.ax) { const t = await send("Accessibility.getFullAXTree"); results.push({ label: "ax", value: JSON.stringify((t.result?.nodes || []).filter(n => !n.ignored && ["button","link","heading","image","textbox","dialog","img"].includes(n.role?.value)).map(n => n.role.value + ": " + (n.name?.value || "(NO NAME)"))) }); }
  if (s.goto) {
    await send('Page.navigate', { url: s.goto });
    for (let i = 0; i < 50; i++) { if (events.some((e) => e.method === 'Page.loadEventFired')) break; await sleep(100); }
    events.length = 0; await sleep(400);
  }
  if (s.addInit) await send('Page.addScriptToEvaluateOnNewDocument', { source: s.addInit });
  if (s.eval) results.push({ label: s.label ?? s.eval.slice(0, 60), value: await evaluate(s.eval) });
  if (s.tabs) { const seq = []; for (let i = 0; i < s.tabs; i++) { await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }); seq.push(await evaluate("(()=>{const e=document.activeElement;const o=getComputedStyle(e);return (e.getAttribute(\"aria-label\")||e.innerText||e.value||e.tagName).replace(/\\s+/g,\" \").slice(0,45)+\" | outline:\"+o.outlineStyle+\" \"+o.outlineWidth})()")); } results.push({ label: "tab order", value: seq }); }
  if (s.wait) await sleep(s.wait);
  if (s.targets) results.push({ label: "targets", value: (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "page").map((t) => t.url) });
  if (s.shot) {
    const full = s.full !== false;
    let clip;
    if (full) {
      const m = await send('Page.getLayoutMetrics');
      const { width, height } = m.result.cssContentSize;
      clip = { x: 0, y: 0, width, height, scale: 1 };
    }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) });
    writeFileSync(join(outDir, s.shot), Buffer.from(r.result.data, 'base64'));
    results.push({ label: `screenshot ${s.shot}` });
  }
}
console.log(JSON.stringify(results, null, 1));
ws.close(); chrome.kill(); process.exit(0);
