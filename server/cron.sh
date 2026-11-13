#!/bin/bash

export LC_ALL=C.UTF-8

dir=$(cd "$(dirname "$0")" && pwd)
data="$dir/data"
json="$data/data.json"
display="$data/display.png"
screenshot="$data/screenshot.png"
staging_shot="$data/.screenshot.tmp"
staging_display="$data/.display.tmp"

# keep the previous display on any failure: remove new staging files on exit
trap 'rm -f "$staging_shot" "$staging_display"' EXIT

check_png() {
  [ -s "$1" ] && [ "$(head -c 8 "$1" | od -An -tx1 | tr -d ' \n')" = "89504e470d0a1a0a" ]
}
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

# create screenshot: render into a staging file and validate it before
# publishing, so a failed run keeps the previous display and screenshot
rm -rf ~/.config/mozilla ~/.cache/mozilla
killall firefox-esr 2>/dev/null || true
rm -f "$staging_shot" "$staging_display"
firefox-esr --headless --no-remote --window-size=600,800 "--screenshot=$staging_shot" "http://localhost:${DISPLAY_SERVER_PORT:-3030}" >/dev/null 2>&1
browser_status=$?
if [ "$browser_status" -ne 0 ] || ! check_png "$staging_shot"; then
  echo "Screenshot failed (exit $browser_status) - keeping previous display" >&2
  exit 1
fi

# grayscale into a staging file, then publish atomically (mv on the same
# filesystem), so the Kindle never fetches a partially written image
cd "$data" || exit 1
pngcrush -c 0 .screenshot.tmp .display.tmp || {
  echo "Screenshot conversion failed - keeping previous display" >&2
  exit 1
}
if ! check_png .display.tmp; then
  echo "Converted display is not a valid PNG - keeping previous display" >&2
  exit 1
fi
mv -f .screenshot.tmp screenshot.png
mv -f .display.tmp display.png
cd "$dir"
echo "Screenshot created - $height"
