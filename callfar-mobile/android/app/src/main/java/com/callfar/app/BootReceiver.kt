package com.callfar.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * BootReceiver
 * Starts CallKeepAliveService when phone boots up so incoming calls
 * can wake the phone even before the user manually opens CallFar.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val intentAction = intent.action
        if (intentAction == Intent.ACTION_BOOT_COMPLETED ||
            intentAction == "android.intent.action.QUICKBOOT_POWERON" ||
            intentAction == "com.htc.intent.action.QUICKBOOT_POWERON") {
            try {
                val serviceIntent = Intent(context, CallKeepAliveService::class.java)
                serviceIntent.action = CallKeepAliveService.ACTION_START

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } catch (e: Exception) {
                // Boot launch fallback
            }
        }
    }
}
