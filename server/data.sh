#!/bin/bash

dir=$(cd `dirname $0` && pwd)
envFile=$(ls -l $dir/.env | awk '{print $NF}')
now=$(date +'%F %R')

# load config
source $envFile

# Blockchain
blockcount=$(bitcoin-cli -rpcuser=$DISPLAY_BITCOIN_RPC_USER -rpcpassword=$DISPLAY_BITCOIN_RPC_PASS getblockcount 2> /dev/null || echo "null")

# BTCPay
if [[ "${BTCPAY_API_TOKEN}" && "${BTCPAY_HOST}" ]]; then
  rates=$(curl -s -f -H "Authorization: Basic $BTCPAY_API_TOKEN" $BTCPAY_HOST/rates | jq -r '.data // "[]"')
fi

# Bitcoin Quotes
quote=$(curl -s -f https://www.bitcoin-quotes.com/quotes/random.json 2> /dev/null || echo "null")

# JSON
jo -p date="$now" blockcount="$blockcount" rates="$rates" quote="$quote" > $dir/data.json
