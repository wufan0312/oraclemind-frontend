import fs from 'node:fs';

const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
await sleep(1500);
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const tgt = list.find((t) => t.id === targetId);

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

// wait for input
for (let i = 0; i < 40; i++) { await sleep(1000); if (await ev(`!!document.querySelector('.ming-input.field-pill')`)) break; }
await sleep(1500);

// input a character and run
await ev(`(function(){
  const input=document.querySelector('.ming-input.field-pill');
  if(!input) throw new Error('no input');
  input.focus(); input.value='福'; input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true}));
  const btns=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('测字'));
  if(btns.length) btns[0].click();
})()`);

// wait for result and the dict jump button
let jumped = false;
for (let i = 0; i < 50; i++) {
  await sleep(1000);
  jumped = await ev(`!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('去字典深查'))`);
  if (jumped) break;
}

if (jumped) {
  await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('去字典深查')).click()`);
}

// wait modal
let modal = false;
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  modal = await ev(`!!document.querySelector('.modal-overlay.active')`);
  if (modal) break;
}

await sleep(1500);
const report = await ev(`(function(){
  const modal=document.querySelector('.modal-overlay.active');
  const title=document.querySelector('.modal-title');
  const body=document.querySelector('.modal-text');
  const char=document.querySelector('.ming-dict-char');
  return {
    jumped,
    modalOpen:!!modal,
    title:title?title.textContent:null,
    bodyLength:body?body.textContent.length:null,
    char:char?char.textContent:null
  };
})()`);

await send('Page.captureScreenshot', { format: 'png' }).then((r) => fs.writeFileSync('F:/project/oraclemind/oraclemind/.workbuddy/tmp/ming_zidian_popup.png', Buffer.from(r.data, 'base64')));

console.log('REPORT', JSON.stringify(report, null, 2));
console.log('ERRORS', errs.length, JSON.stringify(errs.slice(0, 8)));
await ws.close();
process.exit(0);
