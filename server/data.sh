#!/bin/bash

dir=$(cd `dirname $0` && pwd)
envFile=$(ls -l $dir/.env | awk '{print $NF}')
now=$(date +'%F %R')

# load config
source $envFile

# use clearnet by default
tor=""
# check for Tor and use it if working
torCheck=$(torsocks curl -s https://check.torproject.org/ 2>/dev/null | grep -c "Congratulations. This browser is configured to use Tor.")
if [ ${torCheck} -gt 0 ]; then
  tor="torsocks"
fi

# Blockchain
blockcount=$(bitcoin-cli -rpcuser=$DISPLAY_BITCOIN_RPC_USER -rpcpassword=$DISPLAY_BITCOIN_RPC_PASS getblockcount 2> /dev/null || echo "null")

# Fetch rates using custom BTCPay or Bitstamp as fallback
if [[ "${BTCPAY_API_TOKEN}" && "${BTCPAY_HOST}" ]]; then
  usdrate=$($tor curl -s -f -H "Authorization: Basic $BTCPAY_API_TOKEN" $BTCPAY_HOST/rates/BTC/USD | jq -r '.data.rate // "[]"')
  eurrate=$($tor curl -s -f -H "Authorization: Basic $BTCPAY_API_TOKEN" $BTCPAY_HOST/rates/BTC/EUR | jq -r '.data.rate // "[]"')
fi

if [[ -z ${usdrate} ]]; then
  usdrate=$( $tor curl -s -f https://api.kraken.com/0/public/Ticker?pair=XBTUSD | jq -r '.result.XXBTZUSD.c[0] // "[]"')
fi
if [[ -z ${eurrate} ]]; then
  eurrate=$( $tor curl -s -f https://api.kraken.com/0/public/Ticker?pair=XBTEUR | jq -r '.result.XXBTZEUR.c[0] // "[]"')
fi

rates=$(jo -p -a $(jo rate="$usdrate" code="USD") $(jo rate="$eurrate" code="EUR"))

# Bitcoin Quotes
quote=$( $tor curl -s -f https://www.bitcoin-quotes.com/quotes/random.json 2> /dev/null || echo "null")

# JSON
jo -p date="$now" blockcount="$blockcount" rates="$rates" quote="$quote" > $dir/data.json
