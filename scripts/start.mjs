#!/usr/bin/env node
/**
 * One-command runner for the EBSU data warehouse demo. ALL DATA IS SIMULATED.
 *
 *   npm start               prepare whatever is missing, then start the dashboard
 *   npm start -- --dev      the same, with the Next.js development server
 *   npm start -- --no-open --port 3001
 *   npm run check           pre-demo check: reports on everything, changes nothing
 *   npm run setup           everything npm start does except starting the server
 *   npm run etl             run the ETL in this terminal and print its log
 *   npm test                run the ETL tests (no database needed)
 *   npm run generate-data   regenerate the simulated CSV files
 *   npm run reset           drop the warehouse database and load it again from the CSV files
 *   npm run reset-admin     set the login back to ADMIN_USERNAME / ADMIN_PASSWORD from .env.local
 *
 * Uses only Node's built-in modules, plus the project's own mysql2 package once npm has installed it.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IS_WIN = process.platform === "win32";
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const MODE = flag("--check")
  ? "check"
  : flag("--setup-only")
    ? "setup"
    : flag("--reset-admin")
      ? "reset-admin"
      : flag("--reset")
        ? "reset"
        : flag("--generate-data")
          ? "generate"
          : flag("--etl")
            ? "etl"
            : flag("--test")
              ? "test"
              : "start";
const DEV = flag("--dev");
const NO_OPEN = flag("--no-open");
const PORT_ARG = flag("--port") ? Number(args[args.indexOf("--port") + 1]) : null;

const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const SOURCES_DIR = path.join(ROOT, "warehouse", "data", "sources");
const SOURCE_FILES = ["admissions.csv", "bursary.csv", "exams.csv"];
const REFERENCE_FILE = path.join(ROOT, "warehouse", "data", "reference", "departments.csv");
const ETL = path.join("warehouse", "etl", "etl.py");
const GENERATOR = path.join("warehouse", "generator", "generate_data.py");
const RUNTIME = path.join(ROOT, ".runtime");
const BUILD_HASH = path.join(RUNTIME, "build-hash");

// ---------------------------------------------------------------------------
// Console helpers
// ---------------------------------------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint("31"),
  green = paint("32"),
  yellow = paint("33"),
  dim = paint("2"),
  bold = paint("1");
const ok = (msg) => console.log(`  ${green("OK")}    ${msg}`);
const info = (msg) => console.log(`  ${dim("..")}    ${msg}`);
const warn = (msg) => console.log(`  ${yellow("NOTE")}  ${msg}`);
const fail = (msg) => console.log(`  ${red("FAIL")}  ${msg}`);
function die(msg, hint) {
  fail(msg);
  if (hint) console.log(`\n${hint}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// .env.local
// ---------------------------------------------------------------------------
const ENV_PATH = path.join(ROOT, ".env.local");

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function setEnvValue(key, value) {
  let text = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  text = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.replace(/\s*$/, "")}\n${key}=${value}\n`;
  writeFileSync(ENV_PATH, text);
}

function ensureEnvFile(readOnly) {
  if (!existsSync(ENV_PATH)) {
    if (readOnly) return parseEnv(readFileSync(path.join(ROOT, ".env.example"), "utf8"));
    copyFileSync(path.join(ROOT, ".env.example"), ENV_PATH);
    info("Created .env.local from .env.example");
  }
  let env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  if (!readOnly && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16)) {
    setEnvValue("SESSION_SECRET", randomBytes(32).toString("hex"));
    env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  }
  return env;
}

function dbConfig(env) {
  return {
    host: env.DB_HOST || "127.0.0.1",
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || "root",
    password: env.DB_PASSWORD || "",
    database: env.DB_NAME || "ebsu_dw",
  };
}

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------
function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: opts.capture ? "pipe" : "inherit",
    encoding: "utf8",
    shell: opts.shell ?? false,
    env: { ...process.env, ...(opts.env || {}) },
  });
  return { code: res.status ?? 1, out: (res.stdout || "") + (res.stderr || ""), error: res.error };
}

function npmCmd() {
  return IS_WIN ? "npm.cmd" : "npm";
}

// ---------------------------------------------------------------------------
// Node and npm packages
// ---------------------------------------------------------------------------
function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 9)) {
    die(`Node.js ${process.versions.node} is too old; 20.9 or newer is needed.`, "Install the LTS version from https://nodejs.org/ and run npm start again.");
  }
  ok(`Node.js ${process.versions.node}`);
}

function packagesInstalled() {
  return existsSync(NEXT_BIN) && existsSync(path.join(ROOT, "node_modules", "mysql2", "package.json"));
}

function packagesStale() {
  const marker = path.join(ROOT, "node_modules", ".package-lock.json");
  const lock = path.join(ROOT, "package-lock.json");
  return existsSync(marker) && existsSync(lock) && statSync(lock).mtimeMs > statSync(marker).mtimeMs + 1000;
}

function ensurePackages() {
  if (packagesInstalled() && !packagesStale()) return ok("npm packages installed");
  info("Installing the npm packages (first run only, needs internet)");
  const r = run(npmCmd(), ["install", "--no-audit", "--no-fund"], { shell: IS_WIN });
  if (r.code !== 0 || !packagesInstalled()) {
    die("npm install failed.", "Connect to the internet for this first run, then run npm start again.");
  }
  ok("npm packages installed");
}

async function mysqlDriver() {
  const entry = path.join(ROOT, "node_modules", "mysql2", "promise.js");
  return (await import(pathToFileURL(entry).href)).default;
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------
const VENV_DIR = path.join(ROOT, ".venv");
const VENV_PY = IS_WIN ? path.join(VENV_DIR, "Scripts", "python.exe") : path.join(VENV_DIR, "bin", "python");

function findSystemPython() {
  const candidates = IS_WIN
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
  const probe = "import sys; print('%d.%d.%d' % sys.version_info[:3]); sys.exit(0 if sys.version_info >= (3, 9) else 1)";
  for (const [cmd, pre] of candidates) {
    const r = run(cmd, [...pre, "-c", probe], { capture: true });
    if (r.code === 0) return { cmd, pre, version: r.out.trim().split(/\s+/)[0] };
  }
  return null;
}

function hasEtlPackages(cmd, pre = []) {
  return run(cmd, [...pre, "-c", "import pandas, pymysql"], { capture: true }).code === 0;
}

function ensurePython(env, readOnly) {
  // 1. A virtual environment created by an earlier run.
  if (existsSync(VENV_PY) && hasEtlPackages(VENV_PY)) return VENV_PY;
  if (readOnly) {
    if (env.PYTHON_BIN && existsSync(env.PYTHON_BIN) && hasEtlPackages(env.PYTHON_BIN)) return env.PYTHON_BIN;
    return null;
  }
  const sys = findSystemPython();
  if (!sys) {
    die(
      "Python 3.9 or newer was not found.",
      "Install Python from https://www.python.org/downloads/ (tick 'Add python.exe to PATH'),\nthen run npm start again.",
    );
  }
  info(`Found Python ${sys.version}`);
  if (!existsSync(VENV_PY)) {
    info("Creating a Python virtual environment in .venv (first run only)");
    const r = run(sys.cmd, [...sys.pre, "-m", "venv", VENV_DIR]);
    if (r.code !== 0) {
      if (hasEtlPackages(sys.cmd, sys.pre)) {
        warn("Could not create .venv, using the system Python, which already has pandas and PyMySQL");
        return sys.cmd;
      }
      die("Could not create a Python virtual environment.", "Run: python -m venv .venv   then npm start again.");
    }
  }
  info("Installing pandas and PyMySQL into .venv (first run only, needs internet)");
  const pip = run(VENV_PY, ["-m", "pip", "install", "--disable-pip-version-check", "-r", path.join("warehouse", "requirements.txt")]);
  if (pip.code !== 0 || !hasEtlPackages(VENV_PY)) {
    die(
      "Installing the Python packages failed.",
      "Connect to the internet for this first run, or install them yourself:\n  .venv\\Scripts\\python -m pip install -r warehouse/requirements.txt",
    );
  }
  return VENV_PY;
}

function pythonVersion(py) {
  const r = run(py, ["-c", "import sys, pandas; print('%d.%d.%d' % sys.version_info[:3], pandas.__version__)"], { capture: true });
  const [version, pandas] = r.out.trim().split(/\s+/);
  return `Python ${version} with pandas ${pandas} and PyMySQL`;
}

function rememberPython(env, py) {
  if (env.PYTHON_BIN !== py) {
    setEnvValue("PYTHON_BIN", py);
    env.PYTHON_BIN = py;
  }
}

// ---------------------------------------------------------------------------
// Data files
// ---------------------------------------------------------------------------
function dataPresent() {
  return SOURCE_FILES.every((f) => existsSync(path.join(SOURCES_DIR, f))) && existsSync(REFERENCE_FILE);
}

function generateData(py) {
  info("Generating the simulated source files (fixed seed, takes a few seconds)");
  const r = run(py, [GENERATOR]);
  if (r.code !== 0 || !dataPresent()) die("Generating the data failed.", "Scroll up for the Python error.");
  ok("Simulated source files written to warehouse/data/sources");
}

function describeData() {
  const mb = SOURCE_FILES.reduce((a, f) => a + statSync(path.join(SOURCES_DIR, f)).size, 0) / 1_048_576;
  return `Simulated source files present (${SOURCE_FILES.join(", ")}; ${mb.toFixed(1)} MB)`;
}

// ---------------------------------------------------------------------------
// MySQL
// ---------------------------------------------------------------------------
async function connectMysql(cfg, { retries = 10, quiet = false } = {}) {
  const mysql = await mysqlDriver();
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      return await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, connectTimeout: 4000 });
    } catch (e) {
      last = e;
      if (e.code === "ER_ACCESS_DENIED_ERROR") break;
      if (i === 0 && !quiet && retries > 1) info(`Waiting for MySQL at ${cfg.host}:${cfg.port} (start it in the XAMPP Control Panel)`);
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  const err = new Error(last?.message || "MySQL not reachable");
  err.code = last?.code;
  throw err;
}

function mysqlHint(cfg, e) {
  if (e.code === "ER_ACCESS_DENIED_ERROR") {
    return `MySQL refused the login for '${cfg.user}'. Check DB_USER and DB_PASSWORD in .env.local\n(a fresh XAMPP install uses root with an empty password).`;
  }
  return "Open the XAMPP Control Panel and click Start next to MySQL, then run this command again.\nIf MySQL runs on another port, set DB_PORT in .env.local.";
}

async function raiseBufferPool(conn) {
  // XAMPP ships MySQL with a 16 MB buffer pool, which makes the dashboard queries slow.
  // 128 MB is MySQL's own default. The change lasts until MySQL restarts; npm start repeats it.
  try {
    const [[r]] = await conn.query("SELECT @@innodb_buffer_pool_size AS size");
    const size = Number(r.size);
    if (size < 134217728) {
      await conn.query("SET GLOBAL innodb_buffer_pool_size = 134217728");
      info(`Raised MySQL's buffer pool from ${Math.round(size / 1048576)} MB to 128 MB until MySQL restarts`);
    }
  } catch {
    /* not allowed for this account: the dashboard still works, a little slower */
  }
}

async function warehouseState(conn, database) {
  const [db] = await conn.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [database]);
  if (!db.length) return { exists: false, loaded: false };
  const [tables] = await conn.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('fact_enrolment', 'fact_result', 'app_admin', 'etl_run')",
    [database],
  );
  const names = new Set(tables.map((t) => t.TABLE_NAME));
  if (!names.has("fact_enrolment") || !names.has("fact_result")) return { exists: true, loaded: false, hasAdmin: names.has("app_admin") };
  const [[c]] = await conn.query(
    `SELECT (SELECT COUNT(*) FROM \`${database}\`.fact_enrolment) AS enrolments, (SELECT COUNT(*) FROM \`${database}\`.fact_result) AS results`,
  );
  let lastRun = null;
  if (names.has("etl_run")) {
    const [runs] = await conn.query(`SELECT run_id, status, finished_at FROM \`${database}\`.etl_run WHERE status = 'success' ORDER BY run_id DESC LIMIT 1`);
    lastRun = runs[0] ?? null;
  }
  return { exists: true, loaded: Number(c.enrolments) > 0, enrolments: Number(c.enrolments), results: Number(c.results), lastRun, hasAdmin: names.has("app_admin") };
}

function runEtl(py, triggeredBy, extra = []) {
  const r = run(py, [ETL, "--triggered-by", triggeredBy, ...extra], { env: { PYTHONIOENCODING: "utf-8" } });
  if (r.code !== 0) die("The ETL failed.", "Scroll up for its message. The live warehouse tables were left untouched.");
}

// ---------------------------------------------------------------------------
// Admin login (scrypt, the same format src/lib/password.ts checks)
// ---------------------------------------------------------------------------
function hashPassword(password) {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function ensureAdmin(conn, env, database, reset) {
  const username = env.ADMIN_USERNAME || "admin";
  const password = env.ADMIN_PASSWORD || "ebsu-dw-2025";
  const fullName = env.ADMIN_FULL_NAME || "MIS Administrator";
  const [rows] = await conn.query(`SELECT admin_id FROM \`${database}\`.app_admin WHERE username = ?`, [username]);
  if (rows.length && !reset) {
    ok(`Admin login '${username}' exists`);
    return false;
  }
  const hash = hashPassword(password);
  if (rows.length) {
    await conn.query(`UPDATE \`${database}\`.app_admin SET password_hash = ?, full_name = ? WHERE username = ?`, [hash, fullName, username]);
    ok(`Password for '${username}' reset to ADMIN_PASSWORD from .env.local`);
  } else {
    await conn.query(`INSERT INTO \`${database}\`.app_admin (username, full_name, password_hash) VALUES (?, ?, ?)`, [username, fullName, hash]);
    ok(`Created the admin login '${username}'`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
function sourceHash() {
  const h = createHash("sha256");
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(path.relative(ROOT, p).replaceAll("\\", "/")).update(readFileSync(p));
    }
  };
  walk(path.join(ROOT, "src"));
  for (const f of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs"]) {
    const p = path.join(ROOT, f);
    if (existsSync(p)) h.update(f).update(readFileSync(p));
  }
  return h.digest("hex");
}

function buildUpToDate() {
  return existsSync(path.join(ROOT, ".next", "BUILD_ID")) && existsSync(BUILD_HASH) && readFileSync(BUILD_HASH, "utf8").trim() === sourceHash();
}

function ensureBuild() {
  if (buildUpToDate()) return ok("Dashboard build is up to date");
  info("Building the dashboard (first run, or the code has changed; about a minute)");
  const r = run(process.execPath, [NEXT_BIN, "build"], { env: { NEXT_TELEMETRY_DISABLED: "1" } });
  if (r.code !== 0) die("The dashboard build failed.", "Scroll up for the error.");
  mkdirSync(RUNTIME, { recursive: true });
  writeFileSync(BUILD_HASH, sourceHash());
  ok("Dashboard built");
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, () => srv.close(() => resolve(true)));
  });
}

async function freePort(start) {
  for (let p = start; p < start + 20; p++) if (await portFree(p)) return p;
  die(`No free port between ${start} and ${start + 19}.`, "Close another web server, or run: npm start -- --port 4000");
}

function waitForServer(port, timeoutMs = 90_000) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const attempt = () => {
      const req = http.get({ host: "localhost", port, path: "/login", timeout: 3000 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => (Date.now() - t0 > timeoutMs ? resolve(false) : setTimeout(attempt, 700)));
      req.on("timeout", () => req.destroy());
    };
    attempt();
  });
}

function openBrowser(url) {
  const [cmd, cmdArgs] = IS_WIN ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, cmdArgs, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* no browser to open: the URL is printed */
  }
}

async function startServer(env) {
  const port = await freePort(PORT_ARG || 3000);
  if (port !== (PORT_ARG || 3000)) warn(`Port ${PORT_ARG || 3000} is busy, using ${port}`);
  const child = spawn(process.execPath, [NEXT_BIN, DEV ? "dev" : "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, ...env, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: DEV ? "development" : "production" },
  });
  child.stdout.on("data", (d) => {
    // Next prints its own banner; keep only warnings and errors after start-up.
    const text = d.toString();
    if (/error|warn/i.test(text)) process.stdout.write(text);
  });
  const stop = () => {
    child.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => {
    if (code) fail(`The dashboard server stopped (exit code ${code}).`);
    process.exit(code ?? 0);
  });
  const url = `http://localhost:${port}`;
  if (await waitForServer(port)) {
    console.log("");
    ok(`Dashboard running at ${bold(url)}${DEV ? " (development mode)" : ""}`);
    console.log(`        Sign in as ${bold(env.ADMIN_USERNAME || "admin")} with password ${bold(env.ADMIN_PASSWORD || "ebsu-dw-2025")}. Press Ctrl+C to stop.`);
    if (!NO_OPEN) openBrowser(url);
  } else {
    warn(`The server is slow to answer; open ${url} in your browser.`);
  }
}

// ---------------------------------------------------------------------------
// Pre-demo check (changes nothing)
// ---------------------------------------------------------------------------
async function check() {
  let problems = 0;
  const bad = (msg) => {
    problems++;
    fail(msg);
  };
  const [major, minor] = process.versions.node.split(".").map(Number);
  major > 20 || (major === 20 && minor >= 9) ? ok(`Node.js ${process.versions.node}`) : bad(`Node.js ${process.versions.node} is older than 20.9`);
  const hasEnv = existsSync(ENV_PATH);
  const env = ensureEnvFile(true);
  hasEnv ? ok(".env.local present") : warn(".env.local missing: npm start creates it");
  const pkgs = packagesInstalled();
  pkgs ? ok("npm packages installed") : bad("npm packages missing: run npm start once with internet");
  const py = ensurePython(env, true);
  py ? ok(pythonVersion(py)) : bad("Python environment missing: run npm start once with internet");
  dataPresent() ? ok(describeData()) : bad("Simulated source files missing: run npm run generate-data");
  if (pkgs) buildUpToDate() ? ok("Dashboard build is up to date") : warn("Dashboard not built for the current code: npm start builds it (about a minute)");
  if (!pkgs) {
    warn("MySQL not checked (needs the npm packages)");
  } else {
    const cfg = dbConfig(env);
    let conn;
    try {
      conn = await connectMysql(cfg, { retries: 1, quiet: true });
      const [[v]] = await conn.query("SELECT VERSION() AS v");
      ok(`MySQL reachable at ${cfg.host}:${cfg.port} (${v.v})`);
      const s = await warehouseState(conn, cfg.database);
      if (!s.exists) bad(`Database ${cfg.database} does not exist: npm start creates and loads it`);
      else if (!s.loaded) bad(`Warehouse ${cfg.database} is empty: run npm run etl`);
      else ok(`Warehouse loaded: ${s.enrolments.toLocaleString("en")} enrolments, ${s.results.toLocaleString("en")} results${s.lastRun ? `, last ETL run #${s.lastRun.run_id}` : ""}`);
      if (s.hasAdmin) {
        const username = env.ADMIN_USERNAME || "admin";
        const [rows] = await conn.query(`SELECT admin_id FROM \`${cfg.database}\`.app_admin WHERE username = ?`, [username]);
        rows.length ? ok(`Admin login '${username}' exists`) : bad(`No admin login '${username}': run npm run reset-admin`);
      } else if (s.exists) bad("Login table missing: npm start creates it");
    } catch (e) {
      bad(`MySQL not reachable at ${cfg.host}:${cfg.port}: start MySQL in the XAMPP Control Panel`);
    } finally {
      await conn?.end().catch(() => {});
    }
  }
  console.log("");
  if (problems === 0) console.log(green("  Ready for the demo. You can turn the network off."));
  else console.log(red(`  ${problems} problem${problems > 1 ? "s" : ""} found. Fix the FAIL lines, then run npm run check again.`));
  process.exit(problems ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(bold("\nEBSU Data Warehouse and BI Dashboard") + dim("  (all data is simulated)\n"));
  if (MODE === "check") return check();

  checkNode();
  const env = ensureEnvFile(false);

  if (MODE === "test") {
    const py = ensurePython(env, false);
    const r = run(py, ["-m", "unittest", "discover", "-s", path.join("warehouse", "tests"), "-v"]);
    process.exit(r.code);
  }

  const py = ensurePython(env, false);
  rememberPython(env, py);
  ok(pythonVersion(py));

  if (MODE === "generate") {
    generateData(py);
    console.log("\nRun npm run etl, or press Run ETL in the dashboard, to load the new files.\n");
    return;
  }
  if (!dataPresent()) generateData(py);
  else ok(describeData());

  ensurePackages();

  const cfg = dbConfig(env);
  let conn;
  try {
    conn = await connectMysql(cfg);
  } catch (e) {
    die(`MySQL is not reachable at ${cfg.host}:${cfg.port}.`, mysqlHint(cfg, e));
  }
  ok(`MySQL reachable at ${cfg.host}:${cfg.port}`);
  await raiseBufferPool(conn);

  if (MODE === "reset") {
    await conn.query(`DROP DATABASE IF EXISTS \`${cfg.database}\``);
    ok(`Dropped the database ${cfg.database}`);
  }

  let state = await warehouseState(conn, cfg.database);
  if (MODE === "etl") {
    runEtl(py, "npm run etl");
  } else if (!state.loaded) {
    info(state.exists ? "The warehouse is empty: running the ETL" : `Creating the database ${cfg.database} and running the ETL`);
    runEtl(py, MODE === "reset" ? "npm run reset" : "npm start (first run)");
  } else {
    ok(`Warehouse loaded: ${state.enrolments.toLocaleString("en")} enrolments, ${state.results.toLocaleString("en")} results`);
  }
  state = await warehouseState(conn, cfg.database);
  if (!state.hasAdmin) runEtl(py, "npm start", ["--schema-only"]);
  await ensureAdmin(conn, env, cfg.database, MODE === "reset-admin");
  await conn.end().catch(() => {});

  if (MODE === "etl" || MODE === "reset" || MODE === "reset-admin") return;
  if (!DEV) ensureBuild();
  if (MODE === "setup") {
    console.log("\nSet-up complete. Run npm start to open the dashboard.\n");
    return;
  }
  await startServer(env);
}

main().catch((e) => die(e?.message || String(e)));
