#!/bin/bash

dir=$(cd `dirname $0` && pwd)
envFile=$(ls -l $dir/.env | awk '{print $NF}')
now=$(date +'%F %R')

# Load config
source $envFile

# Use clearnet by default, check for Tor and use it if working
tor=""
torCheck=$(torsocks curl -s https://check.torproject.org/ 2>/dev/null | grep -c "Congratulations. This browser is configured to use Tor.")
if [ ${torCheck} -gt 0 ]; then
  tor="torsocks"
fi

# Get block height using RPC connection or Blockchain.info as fallback
if [[ "${DISPLAY_BITCOIN_RPC_USER}" && "${DISPLAY_BITCOIN_RPC_PASS}" ]]; then
  blockcount=$(bitcoin-cli -rpcuser=$DISPLAY_BITCOIN_RPC_USER -rpcpassword=$DISPLAY_BITCOIN_RPC_PASS getblockcount 2> /dev/null)
fi
if [[ -z "${blockcount}" && ${DISPLAY_FALLBACK_BLOCK} = true ]]; then
  blockcount=$($tor curl -s -f https://blockchain.info/q/getblockcount 2> /dev/null)
fi

# Fetch rates using custom BTCPay or Kraken as fallback
if [[ "${BTCPAY_API_TOKEN}" && "${BTCPAY_HOST}" ]]; then
  rate1=$($tor curl -s -f -H "Authorization: Basic $BTCPAY_API_TOKEN" $BTCPAY_HOST/rates/BTC/$DISPLAY_RATE1 | jq -r ".data.rate")

  if [[ ! -z "${DISPLAY_RATE2}" ]]; then
    rate2=$($tor curl -s -f -H "Authorization: Basic $BTCPAY_API_TOKEN" $BTCPAY_HOST/rates/BTC/$DISPLAY_RATE2 | jq -r ".data.rate")
  fi
fi

if [[ ${DISPLAY_FALLBACK_RATES} = true && -z "${rate1}" ]]; then
  rate1=$($tor curl -s -f https://api.kraken.com/0/public/Ticker\?pair=XBT$DISPLAY_RATE1 | jq -r ".result[].c[0]")
fi

if [[ ${DISPLAY_FALLBACK_RATES} = true && -z "${rate2}" && ! -z "${DISPLAY_RATE2}" ]]; then
  rate2=$($tor curl -s -f https://api.kraken.com/0/public/Ticker\?pair=XBT$DISPLAY_RATE2 | jq -r ".result[].c[0]")
fi

# Bitcoin Quotes
quote=$($tor curl -s -f https://www.bitcoin-quotes.com/quotes/random.json 2> /dev/null || echo "null")

# JSON
jo -p date="$now" blockcount="$blockcount" rate1=$(jo rate="$rate1" code="$DISPLAY_RATE1") rate2=$(jo rate="$rate2" code="$DISPLAY_RATE2") quote="$quote"  > $dir/data.json
