# ADB Master — New Features Implementation Plan

> **Status: ALL 17 FEATURES IMPLEMENTED** — Server and client compile cleanly, production build passes.

## Features List

### 1. Device Info Dashboard [DONE]
- **What**: Show battery, Android version, model, resolution, CPU/RAM usage on device selection
- **ADB commands**: `getprop`, `dumpsys battery`, `dumpsys display`, `cat /proc/cpuinfo`, `free -m`, `top -n1 -b`
- **Server**: New `device-info.service.ts`, route `GET /:serial/info`
- **Client**: New `DeviceInfoPage.tsx` with cards for each section
- **i18n**: Add `deviceInfo.*` keys

### 2. Screenshot Capture
- **What**: Capture device screen as PNG, display in UI, allow download
- **ADB commands**: `adb exec-out screencap -p`
- **Server**: New route `GET /:serial/screen/capture` returning PNG binary
- **Client**: Button on device info page or standalone, displays image with download link
- **i18n**: Add `screen.*` keys

### 3. Screen Recording
- **What**: Start/stop recording, download result
- **ADB commands**: `adb shell screenrecord /sdcard/recording.mp4` (spawn), kill to stop, `adb pull`
- **Server**: `POST /:serial/screen/record/start`, `POST /:serial/screen/record/stop`, `GET /:serial/screen/record/download`
- **Client**: Start/stop toggle, timer, download button
- **i18n**: Add `screen.record*` keys

### 4. Wireless ADB Connect/Disconnect
- **What**: Connect to device over WiFi from the UI
- **ADB commands**: `adb tcpip 5555`, `adb connect <ip>:port`, `adb disconnect <ip>:port`
- **Server**: `POST /devices/connect` (body: {host, port}), `POST /devices/disconnect`, `POST /:serial/tcpip`
- **Client**: Dialog on Devices page with host:port input
- **i18n**: Add `devices.wireless*` keys

### 5. App Data Backup/Restore
- **What**: Backup app data to file, restore from file
- **ADB commands**: `adb backup -f <file> <package>`, `adb restore <file>`
- **Server**: `POST /:serial/apps/:pkg/backup` (returns file), `POST /:serial/apps/:pkg/restore` (accepts file)
- **Client**: Backup/Restore buttons per app row
- **i18n**: Add `apps.actions.backup`, `apps.actions.restore` keys

### 6. App Permissions Viewer/Manager
- **What**: List permissions per app, grant/revoke runtime permissions
- **ADB commands**: `dumpsys package <pkg>` (permissions section), `pm grant`, `pm revoke`
- **Server**: `GET /:serial/apps/:pkg/permissions`, `POST /:serial/apps/:pkg/permissions/grant`, `POST /:serial/apps/:pkg/permissions/revoke`
- **Client**: Permissions modal per app with toggle switches
- **i18n**: Add `apps.permissions.*` keys

### 7. App Clear Data / Clear Cache
- **What**: Clear app data or cache
- **ADB commands**: `pm clear <package>`
- **Server**: `POST /:serial/apps/:pkg/clear`
- **Client**: "Clear Data" button per app
- **i18n**: Add `apps.actions.clearData` key

### 8. App Launch
- **What**: Launch an app's main activity
- **ADB commands**: `monkey -p <package> -c android.intent.category.LAUNCHER 1`
- **Server**: `POST /:serial/apps/:pkg/launch`
- **Client**: "Launch" button per app
- **i18n**: Add `apps.actions.launch` key

### 9. App APK Extraction
- **What**: Pull the installed APK from device
- **ADB commands**: `pm path <package>`, then `adb pull <path>`
- **Server**: `GET /:serial/apps/:pkg/apk` (returns APK binary)
- **Client**: "Extract APK" button per app
- **i18n**: Add `apps.actions.extractApk` key

### 10. Intent Launcher
- **What**: Send arbitrary intents/deep links
- **ADB commands**: `am start -a <action> -d <data> -n <component>` etc.
- **Server**: `POST /:serial/intent` with body {action, data, component, extras, flags}
- **Client**: Form with intent fields on a new section or modal
- **i18n**: Add `intent.*` keys

### 11. Port Forwarding Manager
- **What**: Manage adb forward/reverse port mappings
- **ADB commands**: `adb forward tcp:X tcp:Y`, `adb reverse tcp:X tcp:Y`, `adb forward --list`, `adb reverse --list`, `adb forward --remove`
- **Server**: CRUD routes under `/:serial/ports`
- **Client**: Port forwarding section on Network page with add/remove
- **i18n**: Add `network.ports.*` keys

### 12. Multi-device Actions
- **What**: Select multiple devices, run same action on all (install APK, shell command)
- **Server**: No new routes needed — client calls existing endpoints in parallel
- **Client**: Checkbox selection on Devices page, bulk action toolbar
- **i18n**: Add `devices.bulk*` keys

### 13. Logcat Saved Filters
- **What**: Save/load named filter presets (tag+level combos)
- **Server**: Not needed — stored in localStorage
- **Client**: Save/load filter presets in Logcat page
- **i18n**: Add `logcat.presets.*` keys

### 14. Input Injection
- **What**: Send text, taps, swipes, key events to device
- **ADB commands**: `input text`, `input tap x y`, `input swipe`, `input keyevent`
- **Server**: `POST /:serial/input` with body {type, ...params}
- **Client**: Input controls panel (text field, tap coordinates, key event selector)
- **i18n**: Add `input.*` keys

### 15. System Settings Editor
- **What**: View/edit system, secure, global settings
- **ADB commands**: `settings list system/secure/global`, `settings put`, `settings get`
- **Server**: `GET /:serial/settings/:namespace`, `PUT /:serial/settings/:namespace`
- **Client**: Settings page with namespace tabs, key-value editor, quick toggles (animations off, etc.)
- **i18n**: Add `settings.*` keys

### 16. Bugreport Capture
- **What**: Generate and download a bugreport zip
- **ADB commands**: `adb bugreport <path>`
- **Server**: `POST /:serial/bugreport` returns file
- **Client**: Button on device info page
- **i18n**: Add `deviceInfo.bugreport` key

### 17. Device Reboot Controls
- **What**: Reboot, reboot to recovery, reboot to bootloader
- **ADB commands**: `adb reboot`, `adb reboot recovery`, `adb reboot bootloader`
- **Server**: `POST /:serial/reboot` with body {mode}
- **Client**: Reboot dropdown on device info page with confirmation modal
- **i18n**: Add `deviceInfo.reboot.*` keys

---

## Implementation Order
1. Device Info Dashboard (foundation for other device-level features)
2. Screenshot Capture
3. Screen Recording
4. Wireless ADB Connect/Disconnect
5. App Clear Data / Clear Cache
6. App Launch
7. App APK Extraction
8. App Permissions Viewer/Manager
9. App Data Backup/Restore
10. Intent Launcher
11. Port Forwarding Manager
12. Input Injection
13. System Settings Editor
14. Device Reboot Controls
15. Bugreport Capture
16. Logcat Saved Filters
17. Multi-device Actions
