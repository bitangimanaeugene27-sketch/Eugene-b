package com.callfar.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val callId = intent.getStringExtra("callId") ?: ""

        // Stop native ringtone and vibration immediately
        CallNotificationModule.stopRingtoneAndVibration(context)

        if (action == CallNotificationModule.ACTION_DECLINE_CALL) {
            CallNotificationEmitter.emitEvent("onNotificationDeclineCall", callId)
        } else if (action == CallNotificationModule.ACTION_ACCEPT_CALL) {
            CallNotificationEmitter.emitEvent("onNotificationAcceptCall", callId)
        }
    }
}
