#!/bin/bash

dir=$(cd `dirname $0` && pwd)
envFile=$(ls -l $dir/.env | awk '{print $NF}')

# load config
source $envFile

# generate data
cd $dir
npm run data

# create screenshot
cd data
killall firefox-esr 2>/dev/null || true

# Headless Firefox in this GPU-less root container needs explicit settings,
# otherwise it hangs probing the missing graphics stack (glxtest/No GPU).
export MOZ_HEADLESS=1
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/kindle-display-xdg}"
mkdir -p "$XDG_RUNTIME_DIR" && chmod 700 "$XDG_RUNTIME_DIR"

# Throwaway profile (never touch the user's real ~/.mozilla) + software rendering.
profile=$(mktemp -d)
trap 'rm -rf "$profile"' EXIT
printf '%s\n' \
  'user_pref("gfx.webrender.software", true);' \
  'user_pref("layers.acceleration.disabled", true);' \
  'user_pref("webgl.disabled", true);' \
  > "$profile/user.js"

# Bound the run so the pipeline can never wedge even if Firefox hangs.
timeout 30 firefox-esr --headless -profile "$profile" --screenshot screenshot.png --window-size=600,800 "http://localhost:$DISPLAY_SERVER_PORT"
pngcrush -c 0 screenshot.png display.png
