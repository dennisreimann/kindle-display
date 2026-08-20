// Data pipeline: pull live Bitcoin data and write server/data/data.json.
// Runs as part of cron.sh (or manually: `node data.mjs` from server/).
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { request as httpsRequest } from 'https'
import { request as httpRequest } from 'http'
import { getTheme, writeJSON } from './helpers.mjs'

const dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(dir, '.env') })

const { MEMPOOL_BASE_URL, DISPLAY_THEME, DISPLAY_RATE1, DISPLAY_RATE2 } = process.env
const isRandomTheme = DISPLAY_THEME === 'random'
const theme = getTheme(DISPLAY_THEME)

// Mempool API: use a local instance when MEMPOOL_BASE_URL is set, otherwise
// fall back to the public mempool.space. A local instance often uses a
// self-signed TLS certificate, so TLS verification is skipped for local
// hosts only; remote endpoints stay verified.
const mempoolDefault = 'https://mempool.space'
const mempoolBase = MEMPOOL_BASE_URL || mempoolDefault

const isLocalUrl = url => {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.localhost') ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.startsWith('169.254.')
  } catch {
    return false
  }
}
const insecure = isLocalUrl(mempoolBase)

const MAX_BYTES = 5 * 1024 * 1024 // safety cap on response size
const TIMEOUT_MS = 15000

const get = (url, insecure = false) => new Promise(resolve => {
  const mod = url.startsWith('https:') ? httpsRequest : httpRequest
  const req = mod(url, { rejectUnauthorized: !insecure }, res => {
    const chunks = []
    let size = 0
    res.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BYTES) {
        resolve(null)
        return res.destroy()
      }
      chunks.push(chunk)
    })
    res.on('error', () => resolve(null))
    res.on('end', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return resolve(null)
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
      catch { resolve(null) }
    })
  })
  req.setTimeout(TIMEOUT_MS, () => {
    resolve(null)
    req.destroy()
  })
  req.on('error', () => resolve(null))
  req.end()
})
const mempool = path => get(`${mempoolBase}${path}`, insecure)

const now = new Date()
const date = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-') + ' ' + [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')].join(':')

// Load data based on theme
const wantsLn = isRandomTheme || ['lightning'].includes(theme)
const wantsOnchain = isRandomTheme || ['onchain'].includes(theme)
const wantsQuote = isRandomTheme || ['plain'].includes(theme)

const [block, prices, fees, mempoolblocks, lightning, lightningCountries, quote] = await Promise.all([
  mempool('/api/v1/blocks').then(blocks => (blocks?.[0] ?? null)),
  mempool('/api/v1/prices'),
  wantsOnchain ? mempool('/api/v1/fees/precise') : Promise.resolve(null),
  wantsOnchain ? mempool('/api/v1/fees/mempool-blocks') : Promise.resolve(null),
  wantsLn ? mempool('/api/v1/lightning/statistics/latest') : Promise.resolve(null),
  wantsLn ? mempool('/api/v1/lightning/nodes/countries') : Promise.resolve(null),
  wantsQuote ? get('https://www.bitcoin-quotes.com/quotes/random.json') : Promise.resolve(null),
])

const rateOf = code => {
  const value = prices?.[code]
  return { code, ...(value ? { rate: value } : {}) }
}

const rates = [DISPLAY_RATE1, DISPLAY_RATE2].filter(Boolean).map(rateOf)

const data = {
  date,
  block,
  rates,
  quote,
  fees,
  mempoolblocks,
  lightning,
  lightningCountries
}

writeJSON('data/data', data)
