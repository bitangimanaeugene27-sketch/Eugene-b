package com.callfar.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CallNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val CHANNEL_ID = "callfar_incoming_calls_v2"
        const val CHANNEL_NAME = "CallFar Incoming Calls"
        const val NOTIFICATION_ID = 9991
        const val ACTION_ACCEPT_CALL = "com.callfar.app.ACTION_ACCEPT_CALL"
        const val ACTION_DECLINE_CALL = "com.callfar.app.ACTION_DECLINE_CALL"

        private var nativeRingtone: Ringtone? = null
        private var wakeLock: PowerManager.WakeLock? = null
        private var vibrator: Vibrator? = null

        /**
         * Play native telecom ringtone and pulse vibration continuously
         * Runs directly in native Android OS even if JavaScript / React Native is paused by lock screen.
         */
        @Synchronized
        fun startRingtoneAndVibration(context: Context) {
            stopRingtoneAndVibration(context)

            try {
                // 1. Force screen awake
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = powerManager?.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                    "callfar:lockscreen_wake"
                )?.apply {
                    setReferenceCounted(false)
                    acquire(35000) // Keep screen awake for 35s while ringing
                }

                // 2. Play standard system phone ringtone
                val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                nativeRingtone = RingtoneManager.getRingtone(context.applicationContext, ringtoneUri)?.apply {
                    val audioAttributes = AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build()
                    setAudioAttributes(audioAttributes)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        isLooping = true
                    }
                    play()
                }

                // 3. Pulse rhythmic phone vibration
                val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                    vm?.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                }

                vibrator = v
                val pattern = longArrayOf(0, 1000, 800, 1000, 800)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v?.vibrate(VibrationEffect.createWaveform(pattern, 0))
                } else {
                    @Suppress("DEPRECATION")
                    v?.vibrate(pattern, 0)
                }
            } catch (e: Exception) {
                // Fallback handling
            }
        }

        /**
         * Stop native ringtone, stop vibration, dismiss floating overlay, and release wake lock immediately
         */
        @Synchronized
        fun stopRingtoneAndVibration(context: Context) {
            try {
                CallOverlayManager.dismissFloatingCallOverlay(context)
            } catch (e: Exception) {}

            try {
                nativeRingtone?.stop()
                nativeRingtone = null
            } catch (e: Exception) {}

            try {
                vibrator?.cancel()
                vibrator = null
            } catch (e: Exception) {}

            try {
                if (wakeLock?.isHeld == true) {
                    wakeLock?.release()
                }
                wakeLock = null
            } catch (e: Exception) {}

            try {
                val notificationManager =
                    context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                notificationManager?.cancel(NOTIFICATION_ID)
            } catch (e: Exception) {}
        }
    }

    override fun getName(): String = "CallNotificationModule"

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val existing = notificationManager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build()

                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "High-priority incoming call alerts with lock screen pop-up"
                    enableLights(true)
                    lightColor = Color.GREEN
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 1000, 800, 1000, 800)
                    lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                    setBypassDnd(true)
                    setSound(ringtoneUri, audioAttributes)
                }
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    @ReactMethod
    fun showCallNotification(callId: String, callerName: String, callType: String) {
        createNotificationChannel()

        // 1. 🌟 Start native ringtone and vibration immediately
        startRingtoneAndVibration(reactContext)

        // 2. 🚀 Display Floating Pop-up Window over other apps (YouTube, TikTok, etc.)
        CallOverlayManager.showFloatingCallOverlay(reactContext, callId, callerName, callType)

        val notificationManager =
            reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val flag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        // Tap on notification: Open MainActivity
        val tapIntent = Intent(reactContext, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            putExtra("callId", callId)
            putExtra("action", "OPEN_CALL")
        }
        val tapPendingIntent = PendingIntent.getActivity(reactContext, 0, tapIntent, flag)

        // Accept Action Intent: Open MainActivity directly and accept
        val acceptIntent = Intent(reactContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
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
        val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

        val builder = NotificationCompat.Builder(reactContext, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("📞 Incoming $callTypeLabel")
            .setContentText("$callerName is calling you...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(false)
            .setOngoing(true)
            .setSound(ringtoneUri)
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
        stopRingtoneAndVibration(reactContext)
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(CallOverlayManager.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactContext.packageName}")
                ).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
            } catch (e: Exception) {}
        }
    }
}
