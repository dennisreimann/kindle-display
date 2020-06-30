#!/bin/bash

dir=$(cd `dirname $0` && pwd)
envFile=$(ls -l $dir/.env | awk '{print $NF}')

# load config
source $envFile

# generate data
cd $dir
./data.sh

# create screenshot
cd $dir/public
firefox --screenshot http://localhost:$DISPLAY_SERVER_PORT --window-size=600,800
pngcrush -c 0 screenshot.png display.png
