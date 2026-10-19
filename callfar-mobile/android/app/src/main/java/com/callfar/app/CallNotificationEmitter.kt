package com.callfar.app

import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

object CallNotificationEmitter {
    var reactContext: ReactContext? = null

    fun emitEvent(eventName: String, data: String) {
        try {
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, data)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
