'use strict'

// Tests for server/cron.sh. Each run gets an isolated server directory with
// fake node/firefox-esr/pngcrush commands on PATH; the fakes only write to the
// target paths cron passes to them, so the real repository is never touched.
// The node fake forwards `node -e` calls to the real node, so cron's actual
// height extraction code is exercised against the fixture's data.json.

const assert = require('node:assert/strict')
const {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')
const { test } = require('node:test')

const root = join(__dirname, '..')
const SAMPLE_PNG = join(root, '..', 'samples', 'plain.png')

// real pngcrush for the integration test; skipped when it is not installed
const PNGCRUSH = (() => {
  const { execFileSync } = require('node:child_process')
  try {
    return execFileSync('which', ['pngcrush'], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
})()
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const png = (label) => Buffer.concat([PNG_HEADER, Buffer.from(label)])
const DATA_JSON = JSON.stringify({ block: { height: 875001 } })

const nodeFake = () => `#!${process.execPath}
const { spawnSync } = require('child_process')
const { writeFileSync, appendFileSync } = require('fs')
const args = process.argv.slice(2)
if (process.env.TEST_LOG) appendFileSync(process.env.TEST_LOG, 'node ' + JSON.stringify(args) + '\\n')
if (args[0] === 'data.mjs') {
  if (process.env.NODE_FAIL) {
    console.error(process.env.NODE_FAIL)
    process.exit(23)
  }
  writeFileSync('data/data.json', process.env.NODE_DATA || ${JSON.stringify(DATA_JSON)})
  process.exit(0)
}
if (args[0] === '-e') {
  // run cron's real extraction script against the real file
  const real = spawnSync(${JSON.stringify(process.execPath)}, args, { stdio: 'inherit' })
  process.exit(real.status === null ? 1 : real.status)
}
process.exit(0)
`

const browserFake = () => `#!${process.execPath}
const { readFileSync, appendFileSync, writeFileSync } = require('fs')
const args = process.argv.slice(2)
if (process.env.TEST_LOG) appendFileSync(process.env.TEST_LOG, 'firefox-esr ' + JSON.stringify(args) + '\\n')
if (process.env.BROWSER_FAIL) {
  console.error(process.env.BROWSER_FAIL)
  process.exit(19)
}
if (process.env.BROWSER_HANG_MS) {
  process.on('SIGTERM', () => {
    if (process.env.TEST_LOG) appendFileSync(process.env.TEST_LOG, 'browser killed\\n')
    process.exit(99)
  })
  // timer-based wait so the SIGTERM handler can actually run
  const until = Date.now() + Number(process.env.BROWSER_HANG_MS)
  const tick = () => {
    if (Date.now() < until) setTimeout(tick, 25)
    else process.exit(0)
  }
  tick()
}
const flag = args.find((a) => a.startsWith('--screenshot=')) || ''
const target = flag.slice('--screenshot='.length)
if (!target) {
  console.error('no --screenshot target')
  process.exit(1)
}
if (process.env.BROWSER_COPY) {
  writeFileSync(target, readFileSync(process.env.BROWSER_COPY))
} else {
  writeFileSync(target, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fresh browser png')]))
}
`

const converterFake = () => `#!${process.execPath}
const { appendFileSync, writeFileSync } = require('fs')
const args = process.argv.slice(2)
if (process.env.TEST_LOG) appendFileSync(process.env.TEST_LOG, 'pngcrush ' + JSON.stringify(args) + '\\n')
const target = args[args.length - 1]
const mode = process.env.CONVERTER_MODE || 'ok'
if (mode === 'fail') process.exit(22)
if (mode === 'empty') process.exit(0)
if (mode === 'invalid') {
  writeFileSync(target, Buffer.from('not a png'))
  process.exit(0)
}
writeFileSync(target, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fresh gray png')]))
`

const killallFake = () => `#!${process.execPath}
const { appendFileSync } = require('fs')
const args = process.argv.slice(1)
if (process.env.TEST_LOG) appendFileSync(process.env.TEST_LOG, 'killall ' + JSON.stringify(args) + '\\n')
process.exit(0)
`

const FAKES = {
  node: nodeFake,
  'firefox-esr': browserFake,
  pngcrush: converterFake,
  killall: killallFake,
}

function fixture(name = 'server') {
  const parent = mkdtempSync(join(tmpdir(), 'kindle-cron-'))
  const dir = join(parent, name)
  const bin = join(parent, 'bin')
  mkdirSync(join(dir, 'data'), { recursive: true })
  mkdirSync(bin)
  mkdirSync(join(parent, 'home'))
  copyFileSync(join(root, 'cron.sh'), join(dir, 'cron.sh'))
  writeFileSync(join(dir, '.env'), 'DISPLAY_SERVER_PORT=3030\n')
  writeFileSync(join(dir, 'data', 'data.json'), DATA_JSON)
  writeFileSync(join(dir, 'data', 'display.png'), 'previous display')
  writeFileSync(join(dir, 'data', 'screenshot.png'), 'previous screenshot')
  for (const [tool, fake] of Object.entries(FAKES)) {
    writeFileSync(join(bin, tool), fake(), { mode: 0o755 })
  }
  return { parent, dir, bin, log: join(parent, 'tools.log') }
}

function cronEnv(f, env = {}) {
  const inherited = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('DISPLAY_')) inherited[key] = value
  }
  return {
    cwd: f.parent,
    env: {
      ...inherited,
      HOME: join(f.parent, 'home'),
      PATH: `${f.bin}:${inherited.PATH || ''}`,
      TEST_LOG: f.log,
      ...env,
    },
  }
}

function runCron(f, env = {}, spawnTimeoutMs = 30000) {
  const result = spawnSync(join(f.dir, 'cron.sh'), [], {
    ...cronEnv(f, env),
    encoding: 'utf8',
    timeout: spawnTimeoutMs,
  })
  assert.equal(result.signal, null, `cron.sh killed by signal: ${result.signal}`)
  return result
}

const log = (f) => {
  try {
    return readFileSync(f.log, 'utf8')
  } catch {
    return ''
  }
}

const diagnostic = (result, f) =>
  `${result.stdout}\n${result.stderr}\n${log(f)}`

const output = (f, name) => readFileSync(join(f.dir, 'data', name))

test('refreshes display and screenshot on a successful run', () => {
  const f = fixture()
  const result = runCron(f)
  assert.equal(result.status, 0, diagnostic(result, f))
  assert.deepEqual(output(f, 'display.png'), png('fresh gray png'))
  assert.deepEqual(output(f, 'screenshot.png'), png('fresh browser png'))
  assert.match(result.stdout, /875001/)
})

test('works when the server directory path contains spaces', () => {
  const f = fixture('server with spaces')
  const result = runCron(f)
  assert.equal(result.status, 0, diagnostic(result, f))
  assert.deepEqual(output(f, 'display.png'), png('fresh gray png'))
})

test('a failed data pipeline aborts before rendering', () => {
  const f = fixture()
  const result = runCron(f, { NODE_FAIL: 'mempool unavailable' })
  assert.notEqual(result.status, 0)
  assert.match(diagnostic(result, f), /mempool unavailable/)
  assert.doesNotMatch(log(f), /firefox-esr/)
  assert.equal(output(f, 'display.png').toString(), 'previous display')
})

for (const [name, data] of [
  ['invalid JSON', '{oops'],
  ['missing block', '{"rates":[]}'],
  ['missing height', '{"block":{}}'],
  ['null block', '{"block":null}'],
]) {
  test(`invalid block data (${name}) aborts before rendering`, () => {
    const f = fixture()
    const result = runCron(f, { NODE_DATA: data })
    assert.notEqual(result.status, 0, diagnostic(result, f))
    assert.match(diagnostic(result, f), /Invalid block data/)
    assert.doesNotMatch(log(f), /firefox-esr/)
    assert.equal(output(f, 'display.png').toString(), 'previous display')
  })
}

test('defaults to port 3030 when DISPLAY_SERVER_PORT is unset', () => {
  const f = fixture()
  writeFileSync(join(f.dir, '.env'), 'DISPLAY_RATE1="USD"\n')
  const result = runCron(f)
  assert.equal(result.status, 0, diagnostic(result, f))
  assert.match(log(f), /http:\/\/localhost:3030/)
})

test('uses the port from .env', () => {
  const f = fixture()
  writeFileSync(join(f.dir, '.env'), 'DISPLAY_SERVER_PORT=3999\n')
  const result = runCron(f)
  assert.equal(result.status, 0, diagnostic(result, f))
  assert.match(log(f), /http:\/\/localhost:3999/)
})

test('a browser failure keeps the previous display and screenshot', () => {
  const f = fixture()
  const result = runCron(f, { BROWSER_FAIL: 'Firefox crashed on startup' })
  assert.notEqual(result.status, 0)
  assert.match(diagnostic(result, f), /keeping previous display/)
  assert.equal(output(f, 'display.png').toString(), 'previous display')
  assert.equal(output(f, 'screenshot.png').toString(), 'previous screenshot')
})

for (const [name, mode] of [
  ['exits nonzero', 'fail'],
  ['writes no output', 'empty'],
  ['writes a non-PNG', 'invalid'],
]) {
  test(`converter ${name} keeps the previous display and fails`, () => {
    const f = fixture()
    const result = runCron(f, { CONVERTER_MODE: mode })
    assert.equal(result.status, 1, diagnostic(result, f))
    assert.match(diagnostic(result, f), /keeping previous display/)
    assert.equal(output(f, 'display.png').toString(), 'previous display')
  })
}

test('renders and converts into staging files, not the live images', () => {
  const f = fixture()
  const result = runCron(f)
  assert.equal(result.status, 0, diagnostic(result, f))
  const browserLine = log(f).split('\n').find((l) => l.startsWith('firefox-esr'))
  assert.match(browserLine, /--screenshot=[^"]*\.screenshot\.tmp/)
  const converterLine = log(f).split('\n').find((l) => l.startsWith('pngcrush'))
  assert.match(converterLine, /\.screenshot\.tmp/)
  assert.match(converterLine, /\.display\.tmp/)
  assert.doesNotMatch(converterLine, /display\.png/)
})

for (const env of [{}, { CONVERTER_MODE: 'invalid' }]) {
  test(`leaves no staging files behind (${Object.keys(env).length ? 'failure' : 'success'})`, () => {
    const f = fixture()
    const result = runCron(f, env)
    assert.equal(result.status, Object.keys(env).length ? 1 : 0, diagnostic(result, f))
    const leftovers = readdirSync(join(f.dir, 'data')).filter((n) => n.endsWith('.tmp'))
    assert.deepEqual(leftovers, [])
  })
}

test('converts a real PNG with the real pngcrush and publishes it', { skip: !PNGCRUSH && 'pngcrush not installed' }, () => {
  const f = fixture()
  writeFileSync(join(f.bin, 'pngcrush'), `#!/bin/sh\nexec ${PNGCRUSH} "$@"\n`, { mode: 0o755 })
  const result = runCron(f, { BROWSER_COPY: SAMPLE_PNG })
  assert.equal(result.status, 0, diagnostic(result, f))
  const display = output(f, 'display.png')
  assert.deepEqual(display.subarray(0, 8), PNG_HEADER)
  assert.ok(display.length > 100, `display too small: ${display.length} bytes`)
})

const { spawn } = require('node:child_process')
const { once } = require('node:events')

function spawnCron(f, env = {}) {
  // stdio is ignored so orphaned children cannot keep the streams open
  return spawn(join(f.dir, 'cron.sh'), [], { ...cronEnv(f, env), stdio: 'ignore' })
}

test('a hung browser is killed after FIREFOX_TIMEOUT_SECONDS', () => {
  const f = fixture()
  const start = Date.now()
  const result = runCron(f, { BROWSER_HANG_MS: '2900', FIREFOX_TIMEOUT_SECONDS: '2' }, 8000)
  assert.notEqual(result.status, 0)
  assert.match(log(f), /browser killed/)
  assert.match(diagnostic(result, f), /keeping previous display/)
  assert.ok(Date.now() - start < 15000, `run took too long: ${Date.now() - start}ms`)
  assert.equal(output(f, 'display.png').toString(), 'previous display')
  const leftovers = readdirSync(join(f.dir, 'data')).filter((n) => n.endsWith('.tmp'))
  assert.deepEqual(leftovers, [])
})

test('a run is skipped while another update is still in progress', async () => {
  const f = fixture()
  const a = spawnCron(f, { BROWSER_HANG_MS: '60000', FIREFOX_TIMEOUT_SECONDS: '10' })
  const deadline = Date.now() + 10000
  while (!log(f).includes('firefox-esr')) {
    if (Date.now() > deadline) throw new Error('run A never reached the browser')
    spawnSync('sleep', ['0.05'])
  }
  const b = runCron(f)
  assert.equal(b.status, 0, diagnostic(b, f))
  assert.match(b.stderr, /already in progress/)
  assert.equal(log(f).split('\n').filter((l) => l.startsWith('firefox-esr')).length, 1)
  // watchdog for the red phase: cron without a timeout feature would never end
  const watchdog = setTimeout(() => a.kill('SIGKILL'), 20000)
  const [code] = await once(a, 'close')
  clearTimeout(watchdog)
  assert.notEqual(code, 0, 'run A should fail via browser timeout')
  assert.equal(output(f, 'display.png').toString(), 'previous display')
})

test('cron never kills processes by name', () => {
  const f = fixture()
  const result = runCron(f)
  assert.equal(result.status, 0, diagnostic(result, f))
  assert.doesNotMatch(log(f), /^killall/m)
})
