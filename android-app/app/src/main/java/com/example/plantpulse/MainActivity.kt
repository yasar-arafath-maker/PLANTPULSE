package com.example.plantpulse

import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    companion object {
        // ========================================================
        // CLOUD WEB & API URL CONFIGURATION
        // ========================================================
        // 1. When hosted on the cloud, replace with your live URL:
        //    e.g. "https://plantpulse.free.nf/index.html"
        //    or   "https://plantpulse.onrender.com/index.html"
        // 2. Default emulator localhost: "http://10.0.2.2/plant%20monitor%20app/index.html"
        const val CLOUD_APP_URL = "http://10.0.2.2/plant%20monitor%20app/index.html"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            
            // Enable Cookies for sessions & WebView
            CookieManager.getInstance().apply {
                setAcceptCookie(true)
                setAcceptThirdPartyCookies(this@apply, true)
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                    url?.let { view?.loadUrl(it) }
                    return true
                }
            }
            
            // Load PlantPulse Cloud URL
            loadUrl(CLOUD_APP_URL)
        }
        
        setContentView(webView)
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
