package com.example.plantpulse

import android.os.Bundle
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.content.Intent
import android.net.Uri
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import com.example.plantpulse.bridge.PlantPulseNativeBridge
import com.example.plantpulse.sync.SyncManager

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var nativeBridge: PlantPulseNativeBridge

    companion object {
        private const val TAG = "PlantPulseMainActivity"

        // ========================================================
        // CLOUD WEB & API URL CONFIGURATION
        // ========================================================
        // Production Cloud URLs (Render / Cloud HTTPS):
        const val PRODUCTION_APP_URL = "https://plantpulse-backend-qhlo.onrender.com/index.html"
        const val PRODUCTION_API_URL = "https://plantpulse-backend-qhlo.onrender.com/api"

        // Local Development URLs (Emulator/XAMPP):
        const val LOCAL_DEV_APP_URL = "http://10.0.2.2/plant%20monitor%20app/index.html"
        const val LOCAL_DEV_API_URL = "http://10.0.2.2/plant%20monitor%20app/api"

        // Active default targets:
        const val CLOUD_APP_URL = PRODUCTION_APP_URL
        const val DEFAULT_API_BASE_URL = PRODUCTION_API_URL

        // Bundled Local Offline Fallback:
        const val LOCAL_OFFLINE_URL = "file:///android_asset/web/dashboard.html"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        nativeBridge = PlantPulseNativeBridge(this, DEFAULT_API_BASE_URL)

        webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.parseColor("#060E08"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            // Google Play Security Requirement: Do not allow mixed unencrypted content
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false

            // Enable Cookies for sessions & WebView
            val wv = this
            CookieManager.getInstance().apply {
                setAcceptCookie(true)
                setAcceptThirdPartyCookies(wv, true)
            }

            // Register Secure Native Bridge for Offline SQLite & Cloud Sync
            addJavascriptInterface(nativeBridge, "PlantPulseNative")

            webViewClient = object : WebViewClient() {
                private fun isTrustedOrigin(urlStr: String): Boolean {
                    return urlStr.startsWith("file:///android_asset/web/") ||
                            urlStr.contains(".onrender.com") ||
                            urlStr.startsWith("https://plantpulse.infinityfree.me") ||
                            urlStr.startsWith("http://plantpulse.infinityfree.me") ||
                            urlStr.startsWith("http://10.0.2.2") ||
                            urlStr.startsWith("http://localhost")
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val urlStr = request?.url?.toString() ?: return false
                    return handleNavigation(view, urlStr)
                }

                @Deprecated("Deprecated in Java")
                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                    val urlStr = url ?: return false
                    return handleNavigation(view, urlStr)
                }

                private fun handleNavigation(view: WebView?, urlStr: String): Boolean {
                    if (isTrustedOrigin(urlStr)) {
                        view?.loadUrl(urlStr)
                    } else {
                        // Open external link in system browser; never expose native bridge to outside origins
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(urlStr))
                            startActivity(intent)
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to launch external browser for $urlStr", e)
                        }
                    }
                    return true
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    // If primary cloud URL fails due to disconnection, fall back to offline web app
                    if (request?.isForMainFrame == true) {
                        Log.w(TAG, "Network load failed. Loading offline bundled assets.")
                        view?.loadUrl(LOCAL_OFFLINE_URL)
                    }
                }
            }

            // Load remote cloud URL if online; otherwise load local offline assets directly
            if (SyncManager.isConnected(this@MainActivity)) {
                loadUrl(CLOUD_APP_URL)
            } else {
                Log.d(TAG, "Offline on launch. Loading local assets.")
                loadUrl(LOCAL_OFFLINE_URL)
            }
        }

        setContentView(webView)

        // Modern Play Store Compliant Back Press Handler (Predictive Back Navigation)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized) {
                    // Give web UI first priority to dismiss open modals or mobile drawer
                    webView.evaluateJavascript(
                        "(function() { return (typeof window.handleAndroidBackPressed === 'function' ? window.handleAndroidBackPressed() : false); })()"
                    ) { result ->
                        val handled = result == "true" || result == "\"true\""
                        if (!handled) {
                            runOnUiThread {
                                if (webView.canGoBack()) {
                                    webView.goBack()
                                } else {
                                    isEnabled = false
                                    onBackPressedDispatcher.onBackPressed()
                                    isEnabled = true
                                }
                            }
                        }
                    }
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        // Start network monitoring to trigger cloud sync when network reconnects
        SyncManager.startNetworkMonitoring(this) {
            val apiUrl = nativeBridge.getCloudApiUrl()
            val token = nativeBridge.getAuthToken()
            SyncManager.triggerBackgroundSync(this, apiUrl, token) { result ->
                Log.i(TAG, "Background sync result: ${result.message}")
                // Notify WebView to refresh indicators if loaded
                runOnUiThread {
                    webView.evaluateJavascript(
                        "if (window.onNativeSyncCompleted) { window.onNativeSyncCompleted(${result.syncedCount}, ${result.failedCount}); }",
                        null
                    )
                }
            }
        }
    }
}
