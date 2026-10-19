package com.callfar.app

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val callId = intent.getStringExtra("callId") ?: ""

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(CallNotificationModule.NOTIFICATION_ID)

        if (action == CallNotificationModule.ACTION_DECLINE_CALL) {
            CallNotificationEmitter.emitEvent("onNotificationDeclineCall", callId)
        }
    }
}
