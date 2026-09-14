#!/usr/bin/env bash
# Compiles the APK and installs it on a USB-connected phone.
#   npm run apk
#
# Requirements: Android SDK ($HOME/Android/Sdk), Java 21, phone with USB debugging enabled.
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

APK="android/app/build/outputs/apk/release/app-release.apk"

if [ ! -d android ]; then
  echo "android/ directory missing, generating native project first..."
  npx expo prebuild --platform android --no-install
fi

# Gradle does not track the .env file as an input; when it changes, it reuses the old JS bundle
# and does not embed the new settings into the application. Therefore, in each build,
# we clear the bundle output (regeneration takes about half a minute).
rm -rf android/app/build/generated/assets/react \
       android/app/build/intermediates/assets/release

echo "==> Compiling APK"
./android/gradlew -p android assembleRelease

echo "==> Connected devices"
adb devices -l

if ! adb devices | grep -qw device; then
  echo "ERROR: Connected phone not found."
  echo "  - Plug in the USB cable"
  echo "  - USB debugging must be enabled in Developer options on the phone"
  echo "  - Confirm the 'Allow this computer' prompt on the phone"
  exit 1
fi

echo "==> Installing on phone"
adb install -r "$APK"

echo "==> Starting application"
PACKAGE=$(node -e "console.log(require('./app.json').expo.android.package)")
adb shell am start -n $PACKAGE/.MainActivity >/dev/null

echo
echo "Done. APK: $APK ($(du -h "$APK" | cut -f1))"
echo "You can send this file to other family members so they can install it on their phones."
