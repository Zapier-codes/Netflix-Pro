cmake_minimum_required(VERSION 3.22.1)
project("BoxOffice")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_compile_definitions(BUILDING_BOXOFFICE_WITH_GENERATED_CMAKE_PROJECT)

set(NITROGEN_DIR "${CMAKE_SOURCE_DIR}/../../../../nitrogen/generated")

file(GLOB_RECURSE GENERATED_ANDROID_SOURCES "${NITROGEN_DIR}/android/c++/*.cpp")
file(GLOB_RECURSE GENERATED_SHARED_SOURCES "${NITROGEN_DIR}/shared/c++/*.cpp")

include_directories(
    ${NITROGEN_DIR}/android/c++
    ${NITROGEN_DIR}/shared/c++
    ${NITROGEN_DIR}/android        # <-- ADD THIS: BoxOfficeOnLoad.hpp lives here
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