import fs from 'node:fs';

const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1) 建 tab ----
const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const bws = new WebSocket(ver.webSocketDebuggerUrl);
let bid = 0;
const bcall = (m, p = {}) => new Promise((res, rej) => {
  const i = ++bid;
  const h = (e) => { const d = JSON.parse(e.data); if (d.id === i) { bws.removeEventListener('message', h); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result); } };
  bws.addEventListener('message', h);
  bws.send(JSON.stringify({ id: i, method: m, params: p }));
});
await new Promise((r) => bws.addEventListener('open', r));
const { targetId } = await bcall('Target.createTarget', { url: 'about:blank' });
await bws.close();
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const tgt = list.find((t) => t.id === targetId);

// ---- 2) 连 page ----
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
const pending = new Map(); let id = 0;
const errs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map(a=>a.value||a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = ++id; const to = setTimeout(() => reject(new Error('timeout ' + method)), 25000);
  pending.set(i, (m) => { clearTimeout(to); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); });
  ws.send(JSON.stringify({ id: i, method, params }));
});
await new Promise((r) => ws.addEventListener('open', r));
await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:3000/ming' });

const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then((r) => r.result?.value);

// ---- 3) 轮询 ----
let ok = false;
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  if (await ev(`!!document.querySelector('.ming-tabs')`)) { ok = true; break; }
}
await sleep(2500); // 让 hydration 稳定

const report = await ev(`(function(){
  const tabs=[...document.querySelectorAll('.ming-tab')].map(t=>t.textContent.trim());
  const panel=document.querySelector('.ming-panel');
  const cs=panel?getComputedStyle(panel):null;
  const tabBar=document.querySelector('.ming-tabs');
  const csTab=tabBar?getComputedStyle(tabBar):null;
  return {
    tabCount:tabs.length,
    tabs,
    hasZidianTab:tabs.some(t=>t.includes('字典')),
    panelBg:cs?cs.backgroundColor:null,
    panelExists:!!panel,
    tabBarDisplay:csTab?csTab.display:null,
    tabBarBorder:csTab?csTab.borderTopWidth:null
  };
})()`);

await send('Page.captureScreenshot', { format: 'png' }).then((r) => fs.writeFileSync('F:/project/oraclemind/oraclemind/.workbuddy/tmp/ming_verify.png', Buffer.from(r.data, 'base64')));

console.log('NAV_OK', ok);
console.log('REPORT', JSON.stringify(report, null, 2));
console.log('CONSOLE_ERRORS', errs.length, JSON.stringify(errs.slice(0, 8)));
await ws.close();
process.exit(0);
