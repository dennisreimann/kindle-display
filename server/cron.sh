#!/bin/bash

export LC_ALL=C.UTF-8

dir=$(cd "$(dirname "$0")" && pwd)
json="$dir/data/data.json"
display="$dir/data/display.png"
screenshot="$dir/data/screenshot.png"
cd "$dir" || exit 1

# load config
if [ -f .env ]; then
  . ./.env
fi

# generate data
node data.mjs || { echo "Data update failed - keeping previous display" >&2; exit 1; }

# read the block height from the generated data: a missing or invalid block
# means the data pipeline is broken, so don't render from stale data
height=$(node -e '
  const fs = require("fs")
  try {
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
    if (data && data.block && Number.isFinite(data.block.height)) {
      process.stdout.write(String(data.block.height))
    } else {
      process.exit(1)
    }
  } catch {
    process.exit(1)
  }
' "$json") || { echo "Invalid block data - keeping previous display" >&2; exit 1; }
echo "Fetched data for block height $height"

# create screenshot
rm -rf ~/.config/mozilla ~/.cache/mozilla "$screenshot"
killall firefox-esr 2>/dev/null || true
firefox-esr --headless --no-remote --window-size=600,800 "--screenshot=$screenshot" "http://localhost:${DISPLAY_SERVER_PORT:-3030}" >/dev/null 2>&1
[ -f "$screenshot" ] || { echo "Screenshot failed - keeping previous display" >&2; exit 1; }

# grayscale
cd data || exit 1
pngcrush -c 0 "$screenshot" "$display" >/dev/null 2>&1
echo "Screenshot created - $height"
