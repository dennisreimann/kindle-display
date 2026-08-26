import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

const dir = resolve(import.meta.dirname, '.')

export const THEMES = ['plain', 'onchain', 'lightning']

export const write = (name, data) => {
  const dst = join(dir, name)
  mkdirSync(dirname(dst), { recursive: true })
  writeFileSync(dst, data)
}
export const writeJSON = (name, data) => write(`${name}.json`, JSON.stringify(data, null, 2))

const numFormat = new Intl.NumberFormat('en-US')
const btcFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BTC' })

export const currency = code => {
  switch (code) {
    case 'USD':
      return '$'
    case 'EUR':
      return '€'
    case 'GBP':
      return '£'
    case 'CHF':
      return 'CHF'
    case 'CAD':
      return 'C$'
    case 'AUD':
      return 'A$'
    case 'JPY':
      return '¥'
    default:
      return code
  }
}

export const sats2BTC = value => {
  const btc = value/100000000
  const formatted = btcFormat.format(btc)
  return formatted.replace('BTC', '').trim()
}

export const num = value => numFormat.format(value)

export const getTheme = theme => {
  const t = (theme || THEMES[0]).toLowerCase()
  return t === 'random'
    ? THEMES[Math.floor(Math.random() * THEMES.length)]
    : THEMES.includes(t) ? t : THEMES[0]
}
