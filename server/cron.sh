#!/bin/bash

export LC_ALL=C.UTF-8

dir=$(cd `dirname $0` && pwd)
json="$dir/data/data.json"
profile="$dir/firefox-profile"
display="$dir/data/display.png"
screenshot="$dir/data/screenshot.png"
cd $dir

# load config
source .env

# generate data
node data.mjs
height=$(grep -m1 '"height"' $json | grep -oE '[0-9]+' | head -1)
echo "Fetched data for block height ${height:-unknown}"

# create screenshot
rm -rf ~/.mozilla ~/.cache/mozilla "$screenshot"
killall firefox-esr 2>/dev/null || true
firefox-esr --headless --no-remote --window-size=600,800 --profile=$profile --screenshot=$screenshot http://localhost:$DISPLAY_SERVER_PORT >/dev/null 2>&1
[ -f "$screenshot" ] || { echo "Screenshot failed - keeping previous display" >&2; exit 1; }

# grayscale
cd data
pngcrush -c 0 "$screenshot" "$display" >/dev/null 2>&1
echo "Screenshot created - ${height:-unknown}"
