package com.callfar.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CallNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val CHANNEL_ID = "callfar_incoming_calls"
        const val CHANNEL_NAME = "CallFar Incoming Calls"
        const val NOTIFICATION_ID = 9991
        const val ACTION_ACCEPT_CALL = "com.callfar.app.ACTION_ACCEPT_CALL"
        const val ACTION_DECLINE_CALL = "com.callfar.app.ACTION_DECLINE_CALL"
    }

    override fun getName(): String = "CallNotificationModule"

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val existing = notificationManager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "High-priority pop-up notifications for incoming calls"
                    enableLights(true)
                    lightColor = Color.GREEN
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 1000, 800, 1000, 800)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                    setBypassDnd(true)
                }
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    @ReactMethod
    fun showCallNotification(callId: String, callerName: String, callType: String) {
        createNotificationChannel()

        val notificationManager =
            reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val flag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        // Tap on notification body: Open MainActivity
        val tapIntent = Intent(reactContext, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("callId", callId)
            putExtra("action", "OPEN_CALL")
        }
        val tapPendingIntent = PendingIntent.getActivity(reactContext, 0, tapIntent, flag)

        // Accept Action Intent: Open MainActivity and accept call
        val acceptIntent = Intent(reactContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("callId", callId)
            putExtra("action", "ACCEPT_CALL")
        }
        val acceptPendingIntent = PendingIntent.getActivity(reactContext, 1, acceptIntent, flag)

        // Decline Action Intent: Broadcast to CallActionReceiver
        val declineIntent = Intent(reactContext, CallActionReceiver::class.java).apply {
            action = ACTION_DECLINE_CALL
            putExtra("callId", callId)
        }
        val declinePendingIntent = PendingIntent.getBroadcast(reactContext, 2, declineIntent, flag)

        val callTypeLabel = if (callType.equals("VIDEO", ignoreCase = true)) "Video Call" else "Voice Call"

        val builder = NotificationCompat.Builder(reactContext, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("📞 Incoming $callTypeLabel")
            .setContentText("$callerName is calling you on CallFar...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(tapPendingIntent, true)
            .setContentIntent(tapPendingIntent)
            .setColor(Color.parseColor("#10B981"))
            .addAction(android.R.drawable.ic_menu_call, "Accept", acceptPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)

        notificationManager.notify(NOTIFICATION_ID, builder.build())
    }

    @ReactMethod
    fun dismissCallNotification() {
        val notificationManager =
            reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(NOTIFICATION_ID)
    }
}
