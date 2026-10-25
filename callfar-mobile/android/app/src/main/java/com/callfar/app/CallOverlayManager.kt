package com.callfar.app

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * CallOverlayManager
 * Displays a high-priority floating incoming call pop-up over other apps
 * (YouTube, TikTok, Games, Browser, Home Screen, etc.)
 */
object CallOverlayManager {
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null

    /**
     * Check if user has granted "Display over other apps" (SYSTEM_ALERT_WINDOW)
     */
    fun canDrawOverlays(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
    }

    /**
     * Display the floating call pop-up on top of other running apps
     */
    fun showFloatingCallOverlay(
        context: Context,
        callId: String,
        callerName: String,
        callType: String
    ) {
        Handler(Looper.getMainLooper()).post {
            try {
                if (!canDrawOverlays(context)) {
                    // If overlay permission not granted, launch activity directly as fallback
                    launchCallActivity(context, callId, "OPEN_CALL")
                    return@post
                }

                dismissFloatingCallOverlay(context)

                val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return@post
                windowManager = wm

                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }

                val dp = context.resources.displayMetrics.density

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                    y = (24 * dp).toInt()
                }

                // Root container
                val root = LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding((16 * dp).toInt(), (8 * dp).toInt(), (16 * dp).toInt(), (8 * dp).toInt())
                }

                // Floating card container (Slate 900 background with green accent border)
                val card = LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding((20 * dp).toInt(), (16 * dp).toInt(), (20 * dp).toInt(), (16 * dp).toInt())
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#0F172A")) // Premium dark navy
                        cornerRadius = 24 * dp
                        setStroke((1.5 * dp).toInt(), Color.parseColor("#10B981")) // CallFar green accent border
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        elevation = 24 * dp
                    }
                }

                // Header badge
                val callTypeUpper = if (callType.equals("VIDEO", true)) "VIDEO CALL" else "VOICE CALL"
                val headerText = TextView(context).apply {
                    text = "📞 CALLFAR • INCOMING $callTypeUpper"
                    setTextColor(Color.parseColor("#10B981"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    letterSpacing = 0.08f
                }
                card.addView(headerText)

                // Caller Name
                val nameText = TextView(context).apply {
                    text = callerName
                    setTextColor(Color.parseColor("#FFFFFF"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    setPadding(0, (6 * dp).toInt(), 0, (2 * dp).toInt())
                }
                card.addView(nameText)

                // Subtitle
                val subText = TextView(context).apply {
                    text = "Incoming call... Tap Accept to answer"
                    setTextColor(Color.parseColor("#94A3B8"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                }
                card.addView(subText)

                // Button row
                val btnRow = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(0, (14 * dp).toInt(), 0, 0)
                }

                // Decline button (Red)
                val declineBtn = TextView(context).apply {
                    text = "✕  Decline"
                    setTextColor(Color.parseColor("#FFFFFF"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    setPadding((16 * dp).toInt(), (12 * dp).toInt(), (16 * dp).toInt(), (12 * dp).toInt())
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#DC2626")) // Red 600
                        cornerRadius = 14 * dp
                    }
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                        marginEnd = (10 * dp).toInt()
                    }
                    setOnClickListener {
                        dismissFloatingCallOverlay(context)
                        CallNotificationModule.stopRingtoneAndVibration(context)
                        CallNotificationEmitter.emitEvent("onNotificationDeclineCall", callId)
                    }
                }
                btnRow.addView(declineBtn)

                // Accept button (Green)
                val acceptBtn = TextView(context).apply {
                    text = "📞  Accept"
                    setTextColor(Color.parseColor("#FFFFFF"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    setPadding((16 * dp).toInt(), (12 * dp).toInt(), (16 * dp).toInt(), (12 * dp).toInt())
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#059669")) // Emerald 600
                        cornerRadius = 14 * dp
                    }
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    setOnClickListener {
                        dismissFloatingCallOverlay(context)
                        CallNotificationModule.stopRingtoneAndVibration(context)
                        launchCallActivity(context, callId, "ACCEPT_CALL")
                        CallNotificationEmitter.emitEvent("onNotificationAcceptCall", callId)
                    }
                }
                btnRow.addView(acceptBtn)

                card.addView(btnRow)
                root.addView(card)

                wm.addView(root, params)
                overlayView = root
            } catch (e: Exception) {
                // Overlay fallback
                launchCallActivity(context, callId, "OPEN_CALL")
            }
        }
    }

    /**
     * Remove the floating overlay window
     */
    fun dismissFloatingCallOverlay(context: Context) {
        Handler(Looper.getMainLooper()).post {
            try {
                if (overlayView != null && windowManager != null) {
                    windowManager?.removeView(overlayView)
                    overlayView = null
                }
            } catch (e: Exception) {
                overlayView = null
            }
        }
    }

    private fun launchCallActivity(context: Context, callId: String, action: String) {
        try {
            val intent = Intent(context, MainActivity::class.java).apply {
                this.action = Intent.ACTION_MAIN
                addCategory(Intent.CATEGORY_LAUNCHER)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("callId", callId)
                putExtra("action", action)
            }
            context.startActivity(intent)
        } catch (e: Exception) {}
    }
}
