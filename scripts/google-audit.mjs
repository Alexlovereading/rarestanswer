#!/usr/bin/env node
// Official API contracts:
// https://developers.google.com/identity/protocols/oauth2/native-app
// https://developers.google.com/webmaster-tools/v1/sites/list
// https://developers.google.com/speed/docs/insights/v5/get-started
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SITES_ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites';
const PSI_ENDPOINT =
  'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PATHS = [
  '/explore',
  '/create/song',
  '/create/image',
  '/create/video',
  '/create/workflow',
  '/library',
];

class AuditError extends Error {}
const fail = (message) => {
  throw new AuditError(message);
};

try {
  process.loadEnvFile(resolve(ROOT, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') fail('Unable to load the local .env file.');
}

function required(name) {
  return process.env[name]?.trim() || fail(`Missing ${name}.`);
}

function inside(parent, child) {
  const path = relative(parent, child);
  return (
    path !== '' &&
    path !== '..' &&
    !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
    !isAbsolute(path)
  );
}

async function tokenPath() {
  const path = resolve(ROOT, required('GSC_TOKEN_FILE'));
  const data = resolve(ROOT, 'data');
  if (!inside(data, path))
    fail('GSC_TOKEN_FILE must be inside the ignored data/ directory.');
  try {
    execFileSync(
      'git',
      ['check-ignore', '--quiet', '--', relative(ROOT, path)],
      { cwd: ROOT, stdio: 'ignore' }
    );
  } catch {
    fail('The token file must be ignored by Git.');
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const actualRoot = await realpath(ROOT);
  const actualDir = await realpath(dirname(path));
  if (
    actualDir !== join(actualRoot, 'data') &&
    !inside(join(actualRoot, 'data'), actualDir)
  ) {
    fail('The token directory must not resolve outside data/.');
  }
  try {
    if (!(await lstat(path)).isFile())
      fail('The token path must be a regular file, not a symlink.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return path;
}

async function readJson(path, message) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    fail(message);
  }
}

async function clientConfig() {
  const config = await readJson(
    resolve(ROOT, required('GSC_CLIENT_SECRET_FILE')),
    'Unable to read the installed-app OAuth client JSON.'
  );
  const client = config?.installed;
  if (
    !client ||
    typeof client.client_id !== 'string' ||
    !client.client_id.endsWith('.apps.googleusercontent.com') ||
    typeof client.client_secret !== 'string' ||
    !client.client_secret
  ) {
    fail(
      'GSC_CLIENT_SECRET_FILE must contain a Google Desktop installed-app client.'
    );
  }
  // Endpoints from downloaded JSON are deliberately never used for requests.
  return { client_id: client.client_id, client_secret: client.client_secret };
}

async function existingToken(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    fail('Unable to read the existing OAuth token file.');
  }
}

async function googleJson(url, options, label, timeout = 30_000) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    fail(`${label} request failed or timed out.`);
  }
  if (!response.ok) fail(`${label} returned HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    fail(`${label} returned invalid JSON.`);
  }
}

async function exchangeToken(params) {
  const token = await googleJson(
    TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    },
    'Google token exchange'
  );
  if (typeof token.access_token !== 'string' || !token.access_token)
    fail('Google did not return an access token.');
  if (
    token.scope &&
    (typeof token.scope !== 'string' ||
      token.scope
        .trim()
        .split(/\s+/)
        .some((scope) => scope !== SCOPE))
  ) {
    fail(
      'Google returned scopes beyond Search Console read-only access; token was not saved.'
    );
  }
  return token;
}

async function saveToken(path, token, client, previous) {
  const refresh =
    token.refresh_token ||
    (previous?.client_id === client.client_id
      ? previous.refresh_token
      : undefined);
  if (typeof refresh !== 'string' || !refresh)
    fail('No refresh token was returned; existing token file was preserved.');
  const stored = {
    client_id: client.client_id,
    access_token: token.access_token,
    refresh_token: refresh,
    token_type: token.token_type || 'Bearer',
    scope: token.scope || SCOPE,
    expires_at: Date.now() + (Number(token.expires_in) || 3600) * 1000,
  };
  const temporary = `${path}.${randomBytes(12).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(stored, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporary, path);
    await chmod(path, 0o600);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

function sameState(received, expected) {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorize() {
  const client = await clientConfig();
  const path = await tokenPath();
  const previous = await existingToken(path);
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  let timer;
  let expectedHost;
  let settled = false;
  let finish;
  const callback = new Promise((resolveCode, reject) => {
    finish = (error, code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolveCode(code);
    };
  });
  // Register rejection handling before starting the listener or the timeout.
  callback.catch(() => {});
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Referrer-Policy', 'no-referrer');
    let url;
    try {
      url = new URL(request.url || '/', 'http://127.0.0.1');
    } catch {
      response.writeHead(400).end('Invalid request.');
      return;
    }
    if (
      request.method !== 'GET' ||
      request.headers.host !== expectedHost ||
      url.pathname !== '/oauth2callback'
    ) {
      response.writeHead(404).end('Not found.');
      return;
    }
    if (!sameState(url.searchParams.get('state'), state)) {
      response
        .writeHead(400)
        .end(
          'Invalid authorization state. Return to the original authorization link.'
        );
      return;
    }
    if (settled) {
      response.writeHead(409).end('Authorization callback already handled.');
      return;
    }
    if (url.searchParams.has('error') || !url.searchParams.get('code')) {
      response
        .writeHead(400)
        .end('Authorization was not completed. Return to the terminal.');
      finish(
        new AuditError(
          'Google authorization was denied or incomplete; no token was written.'
        )
      );
      return;
    }
    response
      .writeHead(200)
      .end(
        'Authorization received. You may close this tab and return to the terminal.'
      );
    finish(null, url.searchParams.get('code'));
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 10_000;
  try {
    await new Promise((resolveListen, reject) => {
      server.once('error', () =>
        reject(
          new AuditError('Unable to start the local OAuth callback listener.')
        )
      );
      server.listen(0, '127.0.0.1', resolveListen);
    });
    const address = server.address();
    expectedHost = `127.0.0.1:${address.port}`;
    const redirect = `http://${expectedHost}/oauth2callback`;
    const url = new URL(AUTH_ENDPOINT);
    url.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirect,
      response_type: 'code',
      scope: SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();
    timer = setTimeout(
      () =>
        finish(
          new AuditError(
            'Authorization timed out after five minutes; no token was written.'
          )
        ),
      5 * 60_000
    );
    console.log(
      'Open this Google authorization URL in your browser (Search Console read-only access):'
    );
    console.log(url.toString());
    const code = await callback;
    const token = await exchangeToken({
      ...client,
      code,
      code_verifier: verifier,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    });
    await saveToken(path, token, client, previous);
    console.log(
      'Authorization complete. Token saved privately with mode 0600.'
    );
  } finally {
    clearTimeout(timer);
    server.closeAllConnections();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function accessToken() {
  const client = await clientConfig();
  const path = await tokenPath();
  const previous = await existingToken(path);
  if (!previous?.refresh_token || previous.client_id !== client.client_id)
    fail('No matching refresh token is available. Run auth first.');
  const token = await exchangeToken({
    ...client,
    refresh_token: previous.refresh_token,
    grant_type: 'refresh_token',
  });
  await saveToken(path, token, client, previous);
  return token.access_token;
}

async function sites() {
  const token = await accessToken();
  const result = await googleJson(
    SITES_ENDPOINT,
    { headers: { Authorization: `Bearer ${token}` } },
    'Search Console sites'
  );
  console.log(
    JSON.stringify(
      (result.siteEntry || []).map(({ siteUrl, permissionLevel }) => ({
        siteUrl,
        permissionLevel,
      })),
      null,
      2
    )
  );
}

const SEARCH_DIMENSIONS = new Set([
  'page',
  'query',
  'country',
  'device',
  'date',
  'hour',
]);
// Fresh data (dataState 'all' / 'hourly_all') includes the most recent,
// not-yet-final days; 'hour' requires 'hourly_all' (last ~10 days).
const DATA_STATES = new Set(['final', 'all', 'hourly_all']);

// Read-only Search Analytics export (searchAnalytics.query). Paginates with
// startRow until a short page; prints JSON rows to stdout or --out FILE.
async function search(args) {
  const opts = { days: '28', dimensions: 'page', limit: '25000', state: 'final' };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (!['site', 'days', 'dimensions', 'limit', 'out', 'state'].includes(key) || !value)
      fail('search accepts --site, --days, --dimensions, --limit, --out, --state.');
    opts[key] = value;
  }
  if (!opts.site) fail('search requires --site (e.g. sc-domain:example.com).');
  const days = Number(opts.days);
  const limit = Number(opts.limit);
  if (!Number.isInteger(days) || days < 1 || days > 480)
    fail('--days must be an integer between 1 and 480.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100_000)
    fail('--limit must be an integer between 1 and 100000.');
  const dimensions = opts.dimensions.split(',');
  if (!dimensions.every((d) => SEARCH_DIMENSIONS.has(d)))
    fail(`--dimensions must be from: ${[...SEARCH_DIMENSIONS].join(', ')}.`);
  if (!DATA_STATES.has(opts.state))
    fail(`--state must be one of: ${[...DATA_STATES].join(', ')}.`);
  if (dimensions.includes('hour') && opts.state !== 'hourly_all')
    fail("--dimensions hour requires --state hourly_all.");
  const fresh = opts.state !== 'final';
  // Final data lags ~2-3 days, so end three days ago for a complete window.
  // Fresh states end today and include partial, not-yet-final data.
  const day = (offset) =>
    new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const endOffset = fresh ? 0 : 3;
  const endDate = day(endOffset);
  const startDate = day(endOffset + days - 1);
  const token = await accessToken();
  const url = `${SITES_ENDPOINT}/${encodeURIComponent(opts.site)}/searchAnalytics/query`;
  const rows = [];
  while (rows.length < limit) {
    const rowLimit = Math.min(25_000, limit - rows.length);
    const result = await googleJson(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          type: 'web',
          ...(fresh ? { dataState: opts.state } : {}),
          rowLimit,
          startRow: rows.length,
        }),
      },
      'Search Console searchAnalytics'
    );
    const page = result.rows || [];
    rows.push(...page);
    if (page.length < rowLimit) break;
  }
  const output = `${JSON.stringify({ site: opts.site, startDate, endDate, dataState: opts.state, dimensions, rows }, null, 2)}\n`;
  if (opts.out) {
    await mkdir(dirname(resolve(opts.out)), { recursive: true });
    await writeFile(resolve(opts.out), output, { mode: 0o600 });
    console.log(
      `Wrote ${rows.length} rows (${startDate}..${endDate}) to ${opts.out}`
    );
  } else {
    process.stdout.write(output);
  }
}

async function performance(args) {
  const key = required('PAGESPEED_API_KEY');
  let outDir;
  let base = 'https://synthpulseai.com';
  let paths = PATHS;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--out-dir' && args[index + 1])
      outDir = resolve(args[++index]);
    else if (args[index] === '--base-url' && args[index + 1])
      base = args[++index];
    else if (args[index] === '--paths' && args[index + 1])
      paths = args[++index].split(',').filter(Boolean);
    else
      fail(
        'Usage: performance [--out-dir DIRECTORY] [--base-url https://example.com] [--paths /a,/b]'
      );
  }
  if (!paths.length || !paths.every((p) => /^\/[a-z0-9/_-]*$/.test(p)))
    fail('--paths must be comma-separated absolute paths like /tools/x.');
  let origin;
  try {
    origin = new URL(base);
  } catch {
    fail('Invalid --base-url.');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/'
  )
    fail('--base-url must be an HTTPS origin without credentials.');
  if (outDir) await mkdir(outDir, { recursive: true });
  const jobs = paths.flatMap((path) =>
    ['mobile', 'desktop'].map((strategy) => ({ path, strategy }))
  );
  let next = 0;
  let failures = 0;
  async function worker() {
    while (next < jobs.length) {
      const { path, strategy } = jobs[next++];
      try {
        const url = new URL(PSI_ENDPOINT);
        url.search = new URLSearchParams({
          url: new URL(path, origin).href,
          strategy,
          category: 'performance',
        }).toString();
        const report = await googleJson(
          url,
          { headers: { 'X-Goog-Api-Key': key } },
          'PageSpeed Insights',
          120_000
        );
        if (outDir) {
          const filename = `${path.slice(1).replaceAll('/', '-')}-${strategy}.json`;
          await writeFile(
            join(outDir, filename),
            `${JSON.stringify(report, null, 2).replaceAll(key, '[REDACTED]')}\n`,
            { mode: 0o600 }
          );
        }
        const lighthouse = report.lighthouseResult;
        if (!lighthouse || lighthouse.runtimeError)
          fail('PageSpeed did not return a completed Lighthouse analysis.');
        const audits = lighthouse.audits || {};
        const score = lighthouse.categories?.performance?.score;
        console.log(
          JSON.stringify({
            path,
            strategy,
            score: typeof score === 'number' ? Math.round(score * 100) : null,
            fcpMs: audits['first-contentful-paint']?.numericValue,
            lcpMs: audits['largest-contentful-paint']?.numericValue,
            tbtMs: audits['total-blocking-time']?.numericValue,
            cls: audits['cumulative-layout-shift']?.numericValue,
            speedIndexMs: audits['speed-index']?.numericValue,
            transferBytes: audits['total-byte-weight']?.numericValue,
          })
        );
      } catch (error) {
        failures++;
        console.error(
          JSON.stringify({
            path,
            strategy,
            error:
              error instanceof AuditError
                ? error.message
                : 'Unable to complete or save this analysis.',
          })
        );
      }
    }
  }
  // At most two in-flight analyses; each job runs once.
  await Promise.all([worker(), worker()]);
  if (failures) process.exitCode = 1;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'performance') return performance(args);
  if (command === 'search') return search(args);
  if (args.length) fail('auth and sites do not accept extra arguments.');
  if (command === 'auth') return authorize();
  if (command === 'sites') return sites();
  console.log(
    'Usage: node scripts/google-audit.mjs auth|sites|search --site SITE [--days 28] [--dimensions page,query,hour] [--state final|all|hourly_all] [--limit N] [--out FILE]|performance [--out-dir DIRECTORY] [--base-url HTTPS_ORIGIN] [--paths /a,/b]'
  );
  if (command && command !== '--help') process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    error instanceof AuditError
      ? error.message
      : 'Google audit failed. Check local configuration and network access.'
  );
  process.exitCode = 1;
});
