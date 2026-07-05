# Run this from C:\Users\Boss\Desktop\EDGES\Flux
# Usage:  .\fix-boxoffice-nitro.ps1

$ErrorActionPreference = "Stop"

# ---------- 1. DELETE the vestigial JSI bridge (dead code, pre-Nitro architecture) ----------
$bridgeCpp = ".\modules\boxoffice\nitro\android\src\main\cpp\BoxOfficeNitroBridge.cpp"
$bridgeH   = ".\modules\boxoffice\nitro\android\src\main\cpp\BoxOfficeNitroBridge.h"

if (Test-Path $bridgeCpp) { Remove-Item $bridgeCpp -Force; Write-Host "Deleted $bridgeCpp" }
if (Test-Path $bridgeH)   { Remove-Item $bridgeH -Force;   Write-Host "Deleted $bridgeH" }

# ---------- 2. CREATE OnLoad.cpp (JNI_OnLoad entry point) ----------
$onLoadPath = ".\modules\boxoffice\nitro\android\src\main\cpp\OnLoad.cpp"
Set-Content -Path $onLoadPath -Encoding utf8 -Value @'
#include <jni.h>
#include "BoxOfficeOnLoad.hpp"

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
  return margelo::nitro::boxoffice::initialize(vm);
}
'@
Write-Host "Created $onLoadPath"

# ---------- 3. OVERWRITE CMakeLists.txt ----------
$cmakePath = ".\modules\boxoffice\nitro\android\src\main\cpp\CMakeLists.txt"
Set-Content -Path $cmakePath -Encoding utf8 -Value @'
cmake_minimum_required(VERSION 3.22.1)
project("BoxOffice")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_compile_definitions(BUILDING_BOXOFFICE_WITH_GENERATED_CMAKE_PROJECT)

set(NITROGEN_DIR "${CMAKE_SOURCE_DIR}/../../../../../nitrogen/generated")

file(GLOB_RECURSE GENERATED_ANDROID_SOURCES "${NITROGEN_DIR}/android/c++/*.cpp")
file(GLOB_RECURSE GENERATED_SHARED_SOURCES "${NITROGEN_DIR}/shared/c++/*.cpp")

include_directories(
    ${NITROGEN_DIR}/android/c++
    ${NITROGEN_DIR}/shared/c++
    ${CMAKE_SOURCE_DIR}
)

add_library(BoxOffice SHARED
    ${GENERATED_ANDROID_SOURCES}
    ${GENERATED_SHARED_SOURCES}
    "${NITROGEN_DIR}/android/BoxOfficeOnLoad.cpp"
    OnLoad.cpp
)

find_library(LOG_LIB log)
find_package(fbjni REQUIRED CONFIG)
find_package(ReactAndroid REQUIRED CONFIG)
find_package(react-native-nitro-modules REQUIRED CONFIG)

target_link_libraries(BoxOffice
    ${LOG_LIB}
    android
    fbjni::fbjni
    ReactAndroid::jsi
    react-native-nitro-modules::NitroModules
)

if(ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)
    target_link_libraries(BoxOffice ReactAndroid::reactnative)
else()
    target_link_libraries(BoxOffice ReactAndroid::react_nativemodule_core ReactAndroid::turbomodulejsijni)
endif()
'@
Write-Host "Wrote $cmakePath"

# ---------- 4. OVERWRITE BoxOfficeNitroPackage.kt ----------
$packagePath = ".\modules\boxoffice\nitro\android\src\main\java\expo\modules\boxoffice\nitro\BoxOfficeNitroPackage.kt"
Set-Content -Path $packagePath -Encoding utf8 -Value @'
package expo.modules.boxoffice.nitro

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.boxoffice.BoxOfficeOnLoad

class BoxOfficeNitroPackage : ReactPackage {
    companion object {
        init {
            BoxOfficeOnLoad.initializeNative()
        }
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = emptyList()

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
'@
Write-Host "Wrote $packagePath"

# ---------- 5. OVERWRITE nitro.json ----------
$nitroJsonPath = ".\modules\boxoffice\nitro.json"
Set-Content -Path $nitroJsonPath -Encoding utf8 -Value @'
{
  "$schema": "https://nitro.margelo.com/nitro.schema.json",
  "cxxNamespace": ["boxoffice"],
  "ios": {
    "iosModuleName": "BoxOffice"
  },
  "android": {
    "androidNamespace": ["boxoffice"],
    "androidCxxLibName": "BoxOffice"
  },
  "autolinking": {
    "BoxOfficeNitroModule": {
      "kotlin": "expo.modules.boxoffice.nitro.HybridBoxOfficeNitroModule"
    }
  },
  "ignorePaths": ["**/node_modules"]
}
'@
Write-Host "Wrote $nitroJsonPath"

Write-Host ""
Write-Host "Done. NOTE: build.gradle was NOT auto-edited (too risky to blind-overwrite)." -ForegroundColor Yellow
Write-Host "Manually add to .\modules\boxoffice\nitro\android\build.gradle:" -ForegroundColor Yellow
Write-Host "  buildFeatures { prefab true }" -ForegroundColor Yellow
Write-Host "  and inside sourceSets.main: kotlin.srcDirs += [`"../../nitrogen/generated/android/kotlin`"]" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then run:" -ForegroundColor Cyan
Write-Host "  npx nitro-codegen" -ForegroundColor Cyan
Write-Host "  cd android; .\gradlew clean; cd .." -ForegroundColor Cyan
Write-Host "  npx expo run:android" -ForegroundColor Cyan