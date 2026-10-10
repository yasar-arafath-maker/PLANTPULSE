# Proguard rules for PlantPulse
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.example.plantpulse.bridge.** { *; }
-keep class com.example.plantpulse.data.model.** { *; }

-dontwarn okhttp3.**
-dontwarn okio.**
