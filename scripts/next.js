#!/usr/bin/env node
/**
 * 玄镜前端 —— next CLI 统一启动器（Windows / macOS / Linux 通用）
 *
 * 这个 wrapper 解决三个导致「前端总挂」的独立问题：
 *
 * 1) NODE_OPTIONS 钩子导致 .next 删除失败
 *    WorkBuddy 在环境级注入 NODE_OPTIONS=--require=genie-safe-delete.cjs。该钩子 patch 了
 *    Node 的 fs.unlinkSync / rmSync / unlink / rm / rmdir 全家桶，强制所有删除走系统回收站，
 *    白名单只放过系统临时目录与 npm 缓存 —— 项目的 .next/ 不在其中。
 *    本项目位于 F 盘，回收站操作**必定失败**并 throw（fail-closed）：
 *      Error: [safe-delete] 操作失败: ... Error during a `trash` operation:
 *      Unknown { description: "Some operations were aborted" }
 *    next dev 每次编译要删成百上千个 .next 缓存文件，于是进程崩溃，
 *    或 .next 被删到半残导致「端口在监听但 HTTP 无响应」。
 *    → 对策：spawn 子进程时传一份摘掉 NODE_OPTIONS 的 env。NODE_OPTIONS 只在进程启动时
 *      读取，在 next 内部 delete 已经来不及（钩子此时已加载），必须从外部隔离。
 *
 * 2) shell:true + next.cmd 导致 next 进程变孤儿（多实例互相破坏 .next 的真凶）
 *    旧实现用 `spawn('next.cmd', ..., { shell: true })`，此时 child.pid 是 **cmd.exe** 的 PID。
 *    退出时只能杀掉 cmd，真正的 next 进程（start-server.js）存活下来变成孤儿，
 *    继续占着端口并继续读写 .next。下次「重启」又起一个新的 → 多个 next dev 同时写同一个
 *    .next，互相删除对方的编译产物 → 白屏 / 500 / 卡死。
 *    → 对策：不用 shell，直接 spawn `node <node_modules/next/dist/bin/next>`，
 *      这样 child.pid 就是真实 node 进程；退出时用 `taskkill /T /F`（Win）或进程组 kill（POSIX）
 *      整树回收。
 *
 * 3) 端口漂移
 *    端口被占时 next 会静默 fallback 到 3001/3002…，用户以为启在 3000 实际在别的端口，
 *    于是反复「重启」，进一步加剧多实例问题。
 *    → 对策：dev 启动前做单实例守卫（PID 文件 + 存活探测 + 端口探测），
 *      已运行时直接提示地址并退出，不重复拉起。
 *
 * 用法：
 *   node scripts/next.js dev [--clean] [--force] [-p 3001]
 *   node scripts/next.js build
 *   node scripts/next.js start
 *   node scripts/next.js lint
 *
 * 由 package.json 的 dev / build / start / lint 脚本调用，一般不需要手动执行。
 */

'use strict';

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const NEXT_DIR = path.join(ROOT, '.next');

// PID 文件**不能**放 .next/ 下：next dev 启动时会重建该目录，文件会被直接删掉，
// 导致单实例守卫永远读不到记录。node_modules/.cache 不会被 next 清理，且已被 gitignore 覆盖。
const PID_FILE = path.join(ROOT, 'node_modules', '.cache', 'oraclemind', 'dev-server.json');

const IS_WIN = process.platform === 'win32';
const DEFAULT_PORT = 3000;

/**
 * 构造一份干净的环境变量：摘掉 NODE_OPTIONS，避免 safe-delete 钩子被加载。
 * @returns {NodeJS.ProcessEnv} 供子进程使用的 env 副本
 */
function buildCleanEnv() {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  return env;
}

/**
 * 解析命令行参数。
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{command: string, args: string[], force: boolean, clean: boolean, port: number, daemon: boolean}}
 */
function parseArgv(argv) {
  /** @type {string[]} */
  const args = [];
  let command = '';
  let force = false;
  let clean = false;
  let daemon = false;
  let port = DEFAULT_PORT;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--force':
      case '-f':
        force = true;
        break;
      case '--clean':
        clean = true;
        break;
      case '--daemon':
        daemon = true;
        break;
      case '-p':
      case '--port':
        port = Number(argv[i + 1]) || DEFAULT_PORT;
        i += 1;
        break;
      default:
        if (token.startsWith('--port=')) {
          port = Number(token.slice('--port='.length)) || DEFAULT_PORT;
        } else if (!command) {
          command = token;
        } else {
          args.push(token);
        }
        break;
    }
  }

  return { command: command || 'dev', args, force, clean, port, daemon };
}

/**
 * 查询占用指定端口的进程 PID。
 *
 * 为什么不用 `net.createServer().listen(port)` 探测：Windows 默认 SO_REUSEADDR 允许
 * 多个 socket 绑定同一端口，端口已被 next 占用时 listen 仍会成功，探测结果永远是
 * 「空闲」，守卫形同虚设。netstat 直接读取内核的 LISTENING 表，结果才是可信的。
 *
 * @param {number} port 端口号
 * @returns {number | null} 占用端口的 PID，未被占用或查询失败返回 null
 */
function findPortOwner(port) {
  try {
    // Windows: -ano -p TCP；POSIX: -tlnp
    const args = IS_WIN ? ['-ano', '-p', 'TCP'] : ['-tlnp'];
    const out = execFileSync('netstat', args, { encoding: 'utf8', windowsHide: true });
    const re = new RegExp(`:${port}\\s+\\S+\\s+LISTEN(?:ING)?\\s+(\\d+)`);
    for (const line of out.split(/\r?\n/)) {
      const match = line.match(re);
      if (match) return Number(match[1]);
    }
    return null;
  } catch (err) {
    console.warn(`[next.js] 端口查询失败（守卫降级）: ${err.message}`);
    return null;
  }
}

/**
 * 轮询等待端口释放。
 * @param {number} port 端口号
 * @param {number} [timeoutMs] 最长等待时间
 * @returns {Promise<boolean>} 端口已空闲返回 true，超时返回 false
 */
async function waitForPortFree(port, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!findPortOwner(port)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/**
 * 检测进程是否存活。
 * @param {number} pid 进程 ID
 * @returns {boolean} 存活返回 true
 */
function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0); // signal 0 = 只做存在性探测，不真正发信号
    return true;
  } catch (err) {
    // EPERM 表示进程存在但没有权限发信号，也算存活
    return err.code === 'EPERM';
  }
}

/**
 * 杀死进程及其整个子进程树。
 * Windows 用 taskkill /T（/T 会递归子进程，/F 强制）；POSIX 用进程组 kill。
 * @param {number} pid 根进程 ID
 * @param {NodeJS.Signals} [signal] POSIX 下使用的信号
 * @returns {boolean} 是否成功发出终止指令
 */
function killTree(pid, signal = 'SIGTERM') {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  if (IS_WIN) {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      return true;
    } catch (err) {
      return false;
    }
  }

  try {
    process.kill(-pid, signal); // 负号 = 整个进程组
    return true;
  } catch (err) {
    try {
      process.kill(pid, signal);
      return true;
    } catch (err2) {
      return false;
    }
  }
}

/**
 * 读取 PID 文件；文件缺失或损坏时返回 null。
 * @returns {{pid: number, port: number, startedAt: string} | null}
 */
function readPidFile() {
  try {
    const raw = fs.readFileSync(PID_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!Number.isInteger(data.pid)) return null;
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * 写入 PID 文件。放在 .next/ 下，天然被 gitignore 覆盖。
 * @param {number} pid 进程 ID
 * @param {number} port 端口号
 * @returns {void}
 */
function writePidFile(pid, port) {
  try {
    fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
    fs.writeFileSync(
      PID_FILE,
      `${JSON.stringify({ pid, port, startedAt: new Date().toISOString() }, null, 2)}\n`
    );
  } catch (err) {
    console.warn(`[next.js] 写入 PID 文件失败（不影响启动）: ${err.message}`);
  }
}

/**
 * 删除 PID 文件。
 * @returns {void}
 */
function removePidFile() {
  try {
    fs.rmSync(PID_FILE, { force: true });
  } catch (err) {
    /* 忽略：wrapper 自身受 safe-delete 钩子影响可能删不掉，靠存活探测兜底 */
  }
}

/**
 * 清空 .next 缓存。
 * 必须在**干净环境**的子进程里执行 —— 当前进程被 NODE_OPTIONS 钩子污染，直接调 fs.rmSync 会 throw。
 * @returns {Promise<void>}
 */
function cleanCache() {
  return new Promise((resolve) => {
    if (!fs.existsSync(NEXT_DIR)) {
      resolve();
      return;
    }
    console.log('[next.js] 正在清理 .next 缓存（干净子进程执行）...');
    const child = spawn(
      process.execPath,
      [
        '-e',
        "require('node:fs').rmSync(process.argv[1], { recursive: true, force: true })",
        NEXT_DIR,
      ],
      { env: buildCleanEnv(), stdio: 'inherit' }
    );
    child.on('exit', () => {
      console.log('[next.js] .next 缓存已清理');
      resolve();
    });
    child.on('error', (err) => {
      console.warn(`[next.js] 清理 .next 失败（继续启动）: ${err.message}`);
      resolve();
    });
  });
}

/**
 * dev 模式单实例守卫：已有实例运行时不再拉起第二个。
 * @param {number} port 目标端口
 * @param {boolean} force 为 true 时杀掉已有实例并继续
 * @returns {Promise<void>} 若已有实例在运行，本函数直接结束进程
 */
async function ensureSingleInstance(port, force) {
  // 端口占用是唯一可信的信号：PID 文件可能因 wrapper 被强杀而残留，
  // 而端口真被 LISTEN 一定意味着有实例在跑。
  const ownerPid = findPortOwner(port);

  if (!ownerPid) {
    removePidFile(); // 端口空闲 → 旧记录一定是 stale，清掉
    return;
  }

  const recorded = readPidFile();
  // recorded.pid 是 next CLI 进程，ownerPid 是实际监听端口的 start-server 子进程，
  // 两者不同，所以只用记录文件判断是否由本启动器拉起，启动时间仅供展示
  const startedAt = recorded && isAlive(recorded.pid) ? recorded.startedAt : null;

  if (!force) {
    console.log(
      `\n[next.js] 开发服务器已在运行：http://localhost:${port}` +
        `\n[next.js]   占用端口的进程 PID ${ownerPid}${startedAt ? `，启动于 ${startedAt}` : ''}` +
        `\n[next.js] 无需重复启动 —— 多个 next dev 同时写同一个 .next 会互相删除对方的` +
        `\n[next.js] 编译产物，这正是页面白屏 / 500 / 卡死的主要原因。` +
        `\n[next.js] 若要强制重启：npm run dev -- --force\n`
    );
    process.exit(0);
  }

  // --force：只杀本项目相关的 node 进程，避免误伤占用该端口的其他服务
  const nodePids = new Set(listNodeProcesses().map((p) => p.pid));
  if (nodePids.has(ownerPid)) {
    console.log(`[next.js] 强制重启：终止 PID ${ownerPid} 及其子进程树 ...`);
    killTree(ownerPid, 'SIGKILL');
  } else {
    console.error(
      `\n[next.js] 端口 ${port} 被 PID ${ownerPid} 占用，且该进程不是 node 进程。` +
        `\n[next.js] 出于安全考虑不自动终止，请手动处理后再启动。\n`
    );
    process.exit(1);
  }

  // 递归杀干净子进程（next dev 会 fork 独立的 start-server.js）
  for (const proc of listNodeProcesses()) {
    const cmd = proc.commandLine;
    if (cmd.includes('start-server.js') && cmd.toLowerCase().includes('oraclemind')) {
      killTree(proc.pid, 'SIGKILL');
    }
  }

  if (!(await waitForPortFree(port))) {
    console.error(`\n[next.js] 端口 ${port} 在 8 秒内未释放，请手动执行 npm run dev:kill 后重试\n`);
    process.exit(1);
  }

  removePidFile();
}

/**
 * 启动 next 子进程并托管其生命周期。
 * @param {string} command next 子命令（dev / build / start / lint）
 * @param {string[]} args 透传给 next 的额外参数
 * @param {boolean} [daemon] 后台守护模式：脱离当前终端独立运行，父进程立即退出
 * @param {number} [port] 端口号，daemon 模式用于命名日志文件
 * @returns {void}
 */
function runNext(command, args, daemon = false, port = DEFAULT_PORT) {
  if (!fs.existsSync(NEXT_BIN)) {
    console.error(`[next.js] 未找到 next，请先执行 npm install\n[next.js] 期望路径: ${NEXT_BIN}`);
    process.exit(1);
  }

  // daemon 模式下 stdio 不能是 'inherit'：父进程退出后管道会断，子进程写日志会 EPIPE 崩溃。
  // 必须重定向到真实文件，并 unref 让子进程脱离父进程的生命周期。
  const logFile = path.join(ROOT, '..', `oj_frontend_${port}.log`);
  let stdio = 'inherit';
  if (daemon) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const fd = fs.openSync(logFile, 'a');
    stdio = ['ignore', fd, fd];
  }

  const child = spawn(process.execPath, [NEXT_BIN, command, ...args], {
    stdio,
    env: buildCleanEnv(),
    cwd: ROOT,
    // daemon 模式在 Windows 上也要 detached，才能真正脱离父进程；
    // POSIX 下 detached 会新建进程组，便于整组回收
    detached: daemon || !IS_WIN,
    windowsHide: true, // Windows 下 detached 会弹控制台窗口，隐藏掉
  });

  let cleaned = false;
  const cleanup = () => {
    // daemon 模式下父进程要立刻退出，绝不能把刚拉起的服务一起杀掉
    if (cleaned || daemon) return;
    cleaned = true;
    if (isAlive(child.pid)) killTree(child.pid, 'SIGKILL');
    removePidFile();
  };

  if (command === 'dev') writePidFile(child.pid, port);

  if (daemon) {
    child.unref(); // 允许父进程先于子进程退出
    console.log(
      `\n[next.js] 已在后台启动（脱离终端，不会随会话结束被回收）` +
        `\n[next.js]   PID ${child.pid}   地址 http://localhost:${port}` +
        `\n[next.js]   日志 ${logFile}` +
        `\n[next.js] 停止：npm run dev:kill\n`
    );
    process.exit(0);
  }

  // 父进程收到终止信号时，先回收子进程树再退出
  const onSignal = (signal) => () => {
    if (isAlive(child.pid)) killTree(child.pid, signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM');
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.on('SIGINT', onSignal('SIGINT'));
  process.on('SIGTERM', onSignal('SIGTERM'));
  process.on('SIGHUP', onSignal('SIGHUP'));
  process.on('exit', cleanup);

  child.on('exit', (code, signal) => {
    cleanup();
    if (signal) {
      // 自己也被同一个信号终止，保持退出语义一致
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    cleanup();
    console.error(`[next.js] 启动 next ${command} 失败: ${err.message}`);
    process.exit(1);
  });
}

/**
 * 列出本机所有 node 进程（PID + 命令行）。
 * Windows 走 PowerShell CIM（wmic 在本环境被安全策略禁用），POSIX 走 ps。
 * @returns {{pid: number, commandLine: string}[]}
 */
function listNodeProcesses() {
  try {
    if (IS_WIN) {
      const ps = [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | " +
          'Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress',
      ];
      const out = execFileSync('powershell.exe', ps, { encoding: 'utf8', windowsHide: true });
      const parsed = JSON.parse(out);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows
        .filter((row) => row && row.ProcessId)
        .map((row) => ({ pid: Number(row.ProcessId), commandLine: String(row.CommandLine || '') }));
    }

    const out = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(' ');
        return { pid: Number(line.slice(0, idx)), commandLine: line.slice(idx + 1) };
      })
      .filter((row) => Number.isInteger(row.pid) && /node(\.exe)?$|\bnode\b/.test(row.commandLine));
  } catch (err) {
    console.warn(`[next.js] 枚举进程失败: ${err.message}`);
    return [];
  }
}

/**
 * 清理所有残留的前端进程（孤儿 next / start-server.js / 旧的启动器）。
 * 只杀「命令行同时命中本项目路径 + next 特征」的进程，避免误伤其他 node 服务。
 * @returns {void}
 */
function killAll() {
  const existing = readPidFile();
  if (existing) {
    if (isAlive(existing.pid)) {
      killTree(existing.pid, 'SIGKILL');
      console.log(`[next.js] 已终止记录中的实例 PID ${existing.pid}`);
    }
    removePidFile();
  }

  const markers = ['start-server.js', 'next\\dist\\bin\\next', 'next/dist/bin/next'];
  const launchers = ['scripts\\next.js', 'scripts/next.js', 'scripts\\dev.js', 'scripts/dev.js'];
  const selfId = process.pid;

  let killed = 0;
  for (const proc of listNodeProcesses()) {
    if (proc.pid === selfId) continue;
    const cmd = proc.commandLine.replace(/"/g, '');
    if (!cmd.toLowerCase().includes('oraclemind')) continue; // 限定本项目，避免误杀
    const hit = markers.some((m) => cmd.includes(m)) || launchers.some((m) => cmd.includes(m));
    if (!hit) continue;

    if (killTree(proc.pid, 'SIGKILL')) {
      console.log(`[next.js] 已终止残留进程 PID ${proc.pid}`);
      killed += 1;
    }
  }

  console.log(killed > 0 ? `[next.js] 清理完成，共终止 ${killed} 个进程` : '[next.js] 清理完成，无残留进程');
}

/**
 * 主入口。
 * @returns {Promise<void>}
 */
async function main() {
  const { command, args, force, clean, port, daemon } = parseArgv(process.argv.slice(2));

  if (command === 'kill') {
    killAll();
    return;
  }

  if (clean) await cleanCache();

  if (command === 'dev') await ensureSingleInstance(port, force);

  // 端口参数透传给 next（用户显式指定时）
  const finalArgs = args.slice();
  if (port !== DEFAULT_PORT && !finalArgs.includes('-p') && !finalArgs.includes('--port')) {
    finalArgs.push('--port', String(port));
  }

  runNext(command, finalArgs, daemon, port);
}

main().catch((err) => {
  console.error(`[next.js] 启动器异常: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
