#!/bin/bash

dir=$(cd `dirname $0` && pwd)
envFile=$(ls -l $dir/.env | awk '{print $NF}')
now=$(date +'%F %R')
dataDir="$dir/data"
mkdir -p "$dataDir"

# Load config
source $envFile

# External proxy flags — applied to external API calls only.
# Local services (Bitcoin RPC, local Mempool) are always reached directly.
proxyFlags=""
if [[ -n "${DISPLAY_SOCKS_PROXY}" ]]; then
  proxyFlags="--socks5-hostname ${DISPLAY_SOCKS_PROXY}"
elif [[ "${DISPLAY_FORCE_TOR}" = true ]]; then
  echo >&2 'Tor is required, but DISPLAY_SOCKS_PROXY is not set.'
  exit 1
fi

# Mempool API: use a local instance when MEMPOOL_API_ADDR is set (direct,
# no proxy), otherwise fall back to the public mempool.space (proxied).
mempoolApi="https://mempool.space"
mempoolFlags="$proxyFlags"
if [[ -n "${MEMPOOL_API_ADDR}" ]]; then
  mempoolApi="http://${MEMPOOL_API_ADDR}"
  mempoolFlags=""
fi

# Get block height using RPC connection or Blockchain.info as fallback
if [[ -n "${BITCOIN_RPC_ADDR}" && "${DISPLAY_BITCOIN_RPC_USER}" && "${DISPLAY_BITCOIN_RPC_PASS}" ]]; then
  blockcount=$(curl -s --data-binary '{"jsonrpc":"1.0","id":"curltext","method":"getblockcount","params":[]}' \
    -H "content-type: text/plain;" \
    --user "${DISPLAY_BITCOIN_RPC_USER}:${DISPLAY_BITCOIN_RPC_PASS}" \
    "http://${BITCOIN_RPC_ADDR}" 2> /dev/null | jq -r ".result // empty" 2> /dev/null)
fi
if [[ -z "${blockcount}" && ${DISPLAY_FALLBACK_BLOCK} = true ]]; then
  blockcount=$(curl $proxyFlags -s -f https://blockchain.info/q/getblockcount 2> /dev/null)
fi

# Fetch exchange rates from Mempool
prices=$(curl $mempoolFlags -s -f ${mempoolApi}/api/v1/prices 2> /dev/null || echo "null")
if [[ -n "${DISPLAY_RATE1}" ]]; then
  rate1=$(echo "$prices" | jq -r ".${DISPLAY_RATE1} // empty" 2> /dev/null)
  if [[ -n "${rate1}" ]]; then
    moscow1=$(echo "100000000 / $rate1" | bc 2>/dev/null)
  fi
fi
if [[ -n "${DISPLAY_RATE2}" ]]; then
  rate2=$(echo "$prices" | jq -r ".${DISPLAY_RATE2} // empty" 2> /dev/null)
  if [[ -n "${rate2}" ]]; then
    moscow2=$(echo "100000000 / $rate2" | bc 2>/dev/null)
  fi
fi

# Bitcoin Quotes (external)
quote=$(curl $proxyFlags -s -f https://www.bitcoin-quotes.com/quotes/random.json 2> /dev/null || echo "null")

# Mempool Stats (local or external, see mempoolFlags)
fees=$(curl $mempoolFlags -s -f ${mempoolApi}/api/v1/fees/recommended 2> /dev/null || echo "null")
mempoolblocks=$(curl $mempoolFlags -s -f ${mempoolApi}/api/v1/fees/mempool-blocks 2> /dev/null || echo "null")
lightning=$(curl $mempoolFlags -s -f ${mempoolApi}/api/v1/lightning/statistics/latest 2> /dev/null || echo "null")

# JSON
jo -p date="$now" blockcount="$blockcount" rate1=$(jo rate="$rate1" moscow="$moscow1" code="$DISPLAY_RATE1") rate2=$(jo rate="$rate2" moscow="$moscow2" code="$DISPLAY_RATE2") quote="$quote" fees="$fees" mempoolblocks="$mempoolblocks" lightning="$lightning"  > $dataDir/data.json
