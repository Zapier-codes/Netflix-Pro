#!/bin/bash
# build-android.sh - Build Android APK without EAS

echo "Building Android APK..."
cd android
./gradlew clean
./gradlew assembleRelease
echo "APK built at: android/app/build/outputs/apk/release/"
