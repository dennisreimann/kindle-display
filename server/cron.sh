#!/bin/sh

dir=$(dirname "$0")

# generate data
cd $dir
sh ./data.sh

# create screenshot
cd $dir/public
firefox --screenshot http://localhost:3030 --window-size=600,800
pngcrush -c 0 screenshot.png display.png
