# modules/boxoffice/nitro/android/proguard-rules.pro

# Keep Nitro module classes
-keep class expo.modules.boxoffice.nitro.** { *; }
-keepclassmembers class expo.modules.boxoffice.nitro.** { *; }

# Keep JSI bridge classes
-keep class com.margelo.nitro.** { *; }
-keepclassmembers class com.margelo.nitro.** { *; }

# Keep C++ bridge methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# General
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod