#include <jni.h>
#include "BoxOfficeOnLoad.hpp"

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
  return margelo::nitro::boxoffice::initialize(vm);
}