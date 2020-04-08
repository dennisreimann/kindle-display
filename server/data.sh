#!/bin/sh

dir=$(dirname "$0")
file=$dir/data.json
now=$(date +'%F %R')

# Blockchain
blockcount=$(bitcoin-cli getblockcount 2> /dev/null || echo "null")

# BTCPay
rates=$(curl -s -f -H "Authorization: Basic $BTCPAY_API_TOKEN" $BTCPAY_HOST/rates | jq -r '.data // "[]"')

# Bitcoin Quotes
quote=$(curl -s -f https://radiant-beyond-56888.herokuapp.com/quotes/random.json 2> /dev/null || echo "null")

# other potential data sources
# mempoolinfo=$(bitcoin-cli getmempoolinfo 2> /dev/null || echo "{}")
# lninfo=$(lncli getinfo 2> /dev/null || echo "{}")
# blockchaininfo=$(bitcoin-cli getblockchaininfo 2> /dev/null || echo "{}")
# txoutsetinfo=$(bitcoin-cli gettxoutsetinfo 2> /dev/null || echo "{}")

# JSON
jo -p date="$now" blockcount="$blockcount" rates="$rates" quote="$quote" > $file
