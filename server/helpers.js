const btcFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BTC' })

module.exports = {
  currency(code) {
    switch (code) {
      case 'USD':
        return '$'
      case 'EUR':
        return '€'
      default:
        return code
    }
  },
  sats2BTC(value) {
    const btc = value/100000000
    const formatted = btcFormat.format(btc)
    return formatted.replace('BTC', '').replace(' ', '')
  }
}
