#!/bin/sh

# saving energy
/etc/init.d/framework stop

# disable screensaver
lipc-set-prop com.lab126.powerd preventScreenSaver 1

# display image
/mnt/us/update.sh
