#!/bin/bash

dir=$(cd `dirname $0` && pwd)
envFile=$(ls -l $dir/.env | awk '{print $NF}')

# load config
source $envFile

# generate data
cd $dir
./data.sh

# cleanup potentially hung up instances of firefox
killall firefox-esr
rm -rf ~/.mozilla ~/.cache/mozilla

# create screenshot
cd $dir/public

if ! type firefox &> /dev/null && [[ -d "/Applications/Firefox.app/Contents/MacOS/" ]]; then
  PATH="$PATH:/Applications/Firefox.app/Contents/MacOS"
fi

firefox-esr --headless --screenshot http://localhost:$DISPLAY_SERVER_PORT --window-size=600,800
pngcrush -c 0 screenshot.png display.png
