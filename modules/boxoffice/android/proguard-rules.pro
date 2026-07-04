# modules/boxoffice/android/proguard-rules.pro

# Keep Chaquopy Python classes
-keep class com.chaquo.python.** { *; }
-keep class com.chaquo.python.android.** { *; }

# Keep Expo module classes
-keep class expo.modules.boxoffice.** { *; }
-keepclassmembers class expo.modules.boxoffice.** { *; }

# Keep Nitro module classes
-keep class expo.modules.boxoffice.nitro.** { *; }
-keepclassmembers class expo.modules.boxoffice.nitro.** { *; }

# Keep Python callback proxy
-keep class expo.modules.boxoffice.PythonEngineManager$EventCallbackProxy { *; }

# Keep Pydantic model fields for reflection
-keepclassmembers class * {
    @com.fasterxml.jackson.annotation.JsonProperty <fields>;
}

# General Android
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Don't warn about missing Python classes at build time
-dontwarn com.chaquo.python.**
-dontwarn org.python.**