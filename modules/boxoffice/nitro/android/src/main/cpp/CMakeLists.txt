# modules/boxoffice/nitro/android/src/main/cpp/CMakeLists.txt

cmake_minimum_required(VERSION 3.22.1)
project("boxofficenitro")

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find React Native JSI
set(REACT_NATIVE_DIR "${CMAKE_SOURCE_DIR}/../../../../../../../node_modules/react-native")
set(NITRO_MODULES_DIR "${CMAKE_SOURCE_DIR}/../../../../../../../node_modules/react-native-nitro-modules")

# Include directories
include_directories(
    ${REACT_NATIVE_DIR}/ReactCommon/jsi
    ${REACT_NATIVE_DIR}/ReactCommon/callinvoker
    ${NITRO_MODULES_DIR}/cpp
    ${CMAKE_SOURCE_DIR}
)

# Source files
set(SOURCES
    BoxOfficeNitroBridge.cpp
)

# Create shared library
add_library(
    boxofficenitro
    SHARED
    ${SOURCES}
)

# Find libraries
find_library(
    LOG_LIB
    log
)

# Link libraries
target_link_libraries(
    boxofficenitro
    ${LOG_LIB}
    android
)