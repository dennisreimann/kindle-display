BASE="http://SERVER:3030"

# Make the Kindle file system writable
mntroot rw

# Create the mnt/base-us scripts according to the files in the kindle directory
cat > /mnt/base-us/RUNME.sh <<EOF
#!/bin/sh

# saving energy
/etc/init.d/framework stop

# disable screensaver
lipc-set-prop com.lab126.powerd preventScreenSaver 1

# display image
/mnt/us/update.sh
EOF

# Set the BASE according to your local network setup to address the server
cat > /mnt/base-us/update.sh <<EOF
#!/bin/sh

BASE=$BASE
FILE=display.png

savePower=false
batteryLevel=\$(lipc-get-prop com.lab126.powerd battLevel)
now=\$(date +'%F %R')

cd "\$(dirname "\$0")"

if [ "\$savePower" = true ]; then
  # power up networking
  lipc-set-prop com.lab126.cmd wirelessEnable 1
  /etc/init.d/wifid start
  sleep 15
fi

# get screenshot and update display
rm \$FILE
if wget "\$BASE/\$FILE"; then
  eips -f -g \$FILE
else
  eips 40 0 "retry"
fi

eips 0 0 "\$now"

# display low battery level
if [ \$batteryLevel -le 25 ]; then
  eips 47 0 "\$batteryLevel%"
fi

if [ "\$savePower" = true ]; then
  # power down networking
  lipc-set-prop com.lab126.cmd wirelessEnable 0
  /etc/init.d/wifid stop
fi
EOF

# add the cronjob
echo "*/5 * * * * /mnt/us/update.sh" > /etc/crontab/root

# Execute the init script and trigger an the first render
sh /mnt/base-us/RUNME.sh
