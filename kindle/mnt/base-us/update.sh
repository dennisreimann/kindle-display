#!/bin/sh

BASE=http://SERVER_IP:3030
FILE=display.png

savePower=false
batteryLevel=$(lipc-get-prop com.lab126.powerd battLevel)
now=$(date +'%F %R')

cd "$(dirname "$0")"

if [ "$savePower" = true ]; then
  # power up networking
  lipc-set-prop com.lab126.cmd wirelessEnable 1
  /etc/init.d/wifid start
  sleep 15
fi

# get screenshot and update display
rm $FILE
if wget "$BASE/$FILE"; then
  eips -f -g $FILE
else
  eips 40 0 "retry"
fi

eips 0 0 "$now"

# display low battery level
if [ $batteryLevel -le 25 ]; then
  eips 47 0 "$batteryLevel%"
fi

if [ "$savePower" = true ]; then
  # power down networking
  lipc-set-prop com.lab126.cmd wirelessEnable 0
  /etc/init.d/wifid stop
fi
