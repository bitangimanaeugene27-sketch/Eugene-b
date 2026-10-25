package com.callfar.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * CallFar Background Keep-Alive Service
 * Keeps the Wi-Fi radio and CPU awake using locks and a low-priority foreground notification.
 * Ensures incoming WebRTC / Socket calls can be received even when the phone is locked.
 */
class CallKeepAliveService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    companion object {
        const val CHANNEL_ID = "callfar_keepalive_channel"
        const val CHANNEL_NAME = "CallFar Active Service"
        const val NOTIFICATION_ID = 9992
        const val ACTION_START = "com.callfar.app.START_KEEPALIVE"
        const val ACTION_STOP = "com.callfar.app.STOP_KEEPALIVE"
    }

    override fun onCreate() {
        super.onCreate()
        createServiceChannel()
        acquireLocks()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForeground(true)
            stopSelf()
            return START_NOT_STICKY
        }

        val notification = buildForegroundNotification()
        startForeground(NOTIFICATION_ID, notification)
        return START_STICKY
    }

    private fun acquireLocks() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (wakeLock == null) {
                wakeLock = powerManager?.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "callfar:keep_alive_partial_wake"
                )?.apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }

            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            if (wifiLock == null) {
                @Suppress("DEPRECATION")
                wifiLock = wifiManager?.createWifiLock(
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                    "callfar:keep_alive_wifi_lock"
                )?.apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }
        } catch (e: Exception) {
            // Lock acquisition fallback
        }
    }

    private fun releaseLocks() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
            wakeLock = null
            if (wifiLock?.isHeld == true) wifiLock?.release()
            wifiLock = null
        } catch (e: Exception) {
            // Lock release fallback
        }
    }

    private fun createServiceChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (notificationManager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Maintains connection to receive incoming calls when screen is locked"
                    setShowBadge(false)
                }
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    private fun buildForegroundNotification(): Notification {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val flag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flag)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CallFar Ready")
            .setContentText("Connected and listening for incoming calls")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    override fun onDestroy() {
        releaseLocks()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
