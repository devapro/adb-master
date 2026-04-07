# Example ADB Script - Device Information Collector
# This script collects basic device information
# Upload this via the Terminal page's script uploader

# Device model and Android version
getprop ro.product.model
getprop ro.build.version.release
getprop ro.build.version.sdk

# Battery status
dumpsys battery | grep -E "level|status|temperature"

# Storage overview
df -h /data
df -h /sdcard

# Memory info
cat /proc/meminfo | head -5

# Screen resolution
wm size

# List running activities
dumpsys activity activities | grep "Run #" | head -10
