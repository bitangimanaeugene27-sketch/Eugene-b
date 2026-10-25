package com.callfar.app

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CallKeepAliveModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CallKeepAliveModule"

    @ReactMethod
    fun startKeepAlive() {
        try {
            val intent = Intent(reactContext, CallKeepAliveService::class.java).apply {
                action = CallKeepAliveService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (e: Exception) {
            // Keep alive fallback
        }
    }

    @ReactMethod
    fun stopKeepAlive() {
        try {
            val intent = Intent(reactContext, CallKeepAliveService::class.java).apply {
                action = CallKeepAliveService.ACTION_STOP
            }
            reactContext.stopService(intent)
        } catch (e: Exception) {
            // Stop fallback
        }
    }
}
