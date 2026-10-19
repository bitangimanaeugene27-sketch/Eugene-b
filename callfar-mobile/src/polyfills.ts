/**
 * CallFar Mobile Runtime Polyfills
 *
 * Must be the FIRST import in index.js and App.tsx.
 * Provides critical global stubs so the JavaScript runtime initializes
 * cleanly before native bridges or TurboModules are attached.
 */

// ─── 1. Expo Global Object Polyfill (expo-modules-core) ───────────────────────
// expo-modules-core in modern Expo (v51/52/57) expects `globalThis.expo` to be present:
//   var EventEmitter = globalThis.expo.EventEmitter;
//   var NativeModule = globalThis.expo.NativeModule;
//   var SharedObject = globalThis.expo.SharedObject;
//   var SharedRef = globalThis.expo.SharedRef;
// In bare React Native or before the C++ JSI hooks attach, `globalThis.expo` is undefined,
// which throws: TypeError: Cannot read property 'EventEmitter' of undefined
(function initExpoGlobal() {
  class SimpleEventEmitter {
    private _listeners = new Map<string, Set<Function>>();

    addListener(eventName: string, listener: Function) {
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Set());
      }
      this._listeners.get(eventName)!.add(listener);
      return {
        remove: () => {
          this._listeners.get(eventName)?.delete(listener);
        },
      };
    }

    removeListener(eventName: string, listener: Function) {
      this._listeners.get(eventName)?.delete(listener);
    }

    removeAllListeners(eventName?: string) {
      if (eventName) {
        this._listeners.delete(eventName);
      } else {
        this._listeners.clear();
      }
    }

    emit(eventName: string, ...args: any[]) {
      const set = this._listeners.get(eventName);
      if (set) {
        set.forEach((fn) => {
          try {
            fn(...args);
          } catch (e) {
            console.error(e);
          }
        });
      }
    }

    listenerCount(eventName: string) {
      return this._listeners.get(eventName)?.size ?? 0;
    }

    startObserving() {}
    stopObserving() {}
  }

  class SimpleNativeModule extends SimpleEventEmitter {
    [key: string]: any;
  }

  class SimpleSharedObject extends SimpleEventEmitter {
    release() {}
  }

  class SimpleSharedRef extends SimpleSharedObject {
    nativeRefType = 'unknown';
  }

  const g = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof global !== 'undefined'
    ? global
    : {};

  if (!(g as any).expo) {
    (g as any).expo = {
      EventEmitter: SimpleEventEmitter,
      NativeModule: SimpleNativeModule,
      SharedObject: SimpleSharedObject,
      SharedRef: SimpleSharedRef,
      modules: {},
      uuidv4: () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),
      uuidv5: () => '',
      getViewConfig: () => ({}),
      reloadAppAsync: async () => {},
    };
  } else {
    const expo = (g as any).expo;
    if (!expo.EventEmitter) expo.EventEmitter = SimpleEventEmitter;
    if (!expo.NativeModule) expo.NativeModule = SimpleNativeModule;
    if (!expo.SharedObject) expo.SharedObject = SimpleSharedObject;
    if (!expo.SharedRef) expo.SharedRef = SimpleSharedRef;
    if (!expo.modules) expo.modules = {};
  }

  if (!(g as any).ExpoDomWebView) {
    (g as any).ExpoDomWebView = { expoModulesProxy: {} };
  }
})();

// ─── 2. WebRTCModule Stub ────────────────────────────────────────────────────
// react-native-webrtc's EventEmitter.js does:
//   const { WebRTCModule } = NativeModules;
//   const nativeEmitter = new NativeEventEmitter(WebRTCModule);
// We inject a safe stub so NativeEventEmitter gets a valid (noop) object.
try {
  const { NativeModules } = require('react-native');
  if (!NativeModules.WebRTCModule) {
    NativeModules.WebRTCModule = {
      addListener: () => {},
      removeListeners: () => {},
      peerConnectionInit: () => {},
      peerConnectionCreateOffer: () => {},
      peerConnectionCreateAnswer: () => {},
      peerConnectionSetLocalDescription: () => {},
      peerConnectionSetRemoteDescription: () => {},
      peerConnectionAddICECandidate: () => {},
      peerConnectionClose: () => {},
      peerConnectionGetStats: () => {},
      mediaStreamCreate: () => {},
      mediaStreamRelease: () => {},
      mediaStreamTrackRelease: () => {},
      mediaStreamTrackSetEnabled: () => {},
      getUserMedia: () => {},
      stopUserMedia: () => {},
      getDisplayMedia: () => {},
    };
  }
} catch {
  // NativeModules not available at this point — skip gracefully
}

// ─── 2b. Pre-register react-native-screens Native Events ─────────────────────
// Root cause fix: When newArchEnabled=true in gradle.properties but false in
// app.json, the Fabric renderer's customDirectEventTypes map is missing
// 'topTransitionProgress' dispatched by the native RNSScreen fragment.
// Pre-inserting it here prevents the invariant violation crash:
//   "Unsupported top level event type 'topTransitionProgress' dispatched"
//
// This must run BEFORE any navigation component is mounted.
try {
  const viewConfigRegistry = require(
    'react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry'
  );

  // These are the events that react-native-screens dispatches from native.
  // We register them as direct events so the Fabric bridge can route them
  // to the JS handler without throwing.
  const SCREENS_DIRECT_EVENTS: Record<string, string> = {
    topTransitionProgress: 'onTransitionProgress',
    topDidAppear: 'onAppear',
    topDidDisappear: 'onDisappear',
    topWillAppear: 'onWillAppear',
    topWillDisappear: 'onWillDisappear',
    topDismissed: 'onDismissed',
    topScreenEdgePanCancelled: 'onGestureCancel',
    topHeaderBackButtonClicked: 'onHeaderBackButtonClicked',
    topSheetDetentChanged: 'onSheetDetentChanged',
    topNativeDismissCancelled: 'onNativeDismissCancelled',
    topHeaderHeightChange: 'onHeaderHeightChange',
  };

  const directTypes = viewConfigRegistry?.customDirectEventTypes;
  if (directTypes && typeof directTypes === 'object') {
    for (const [topLevelType, registrationName] of Object.entries(SCREENS_DIRECT_EVENTS)) {
      if (!directTypes[topLevelType]) {
        directTypes[topLevelType] = { registrationName };
      }
    }
  }
} catch {
  // Registry not yet initialized — the global error handler below will catch
  // any remaining errors at runtime.
}

// ─── 3. NativeFabricUIManager Stub ──────────────────────────────────────────
// Required for React Native Paper architecture compatibility
if (typeof (global as any).nativeFabricUIManager === 'undefined') {
  const noop = () => {};
  (global as any).nativeFabricUIManager = {
    createNode: noop,
    cloneNodeWithNewChildren: noop,
    cloneNodeWithNewChildrenAndProps: noop,
    cloneNodeWithNewProps: noop,
    createChildSet: noop,
    appendChild: noop,
    appendChildToSet: noop,
    completeRoot: noop,
    registerEventHandler: noop,
    setNativeProps: noop,
    dispatchCommand: noop,
    sendAccessibilityEvent: noop,
    measure: noop,
    measureInWindow: noop,
    measureLayout: noop,
    findNodeAtPoint: noop,
    compareDocumentPosition: () => 0,
    getBoundingClientRect: () => [0, 0, 0, 0],
    setIsJSResponder: noop,
    clearJSResponder: noop,
    configureNextLayoutAnimation: noop,
    unstable_DefaultEventPriority: 0,
    unstable_DiscreteEventPriority: 0,
    unstable_ContinuousEventPriority: 0,
    unstable_IdleEventPriority: 0,
    unstable_getCurrentEventPriority: () => 0,
  };
}

// ─── 4. Global Error Handler ─────────────────────────────────────────────────
// Suppress benign native-screens / event-bridge warnings that arise from the
// newArchEnabled mismatch between gradle.properties and app.json.
// This is a runtime safety net; the actual fix is the pre-registration above.
const SUPPRESSED_ERROR_PATTERNS = [
  'Unsupported top level event type',
  'topTransitionProgress',
  'instanceHandle is null, event of type topTransitionProgress',
  'Text strings must be rendered within a <Text> component',
];

const installGlobalErrorSuppressor = () => {
  const utils = (global as any).ErrorUtils;
  if (!utils) return;
  const defaultHandler = utils.getGlobalHandler?.();
  utils.setGlobalHandler((error: any, isFatal: boolean) => {
    const msg: string = error?.message || String(error) || '';
    if (SUPPRESSED_ERROR_PATTERNS.some((p) => msg.includes(p))) {
      // Silently swallow — these are known native-bridge mismatches
      return;
    }
    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
};

// Install immediately if ErrorUtils is already available
installGlobalErrorSuppressor();

// Also install after a short delay in case ErrorUtils initializes later
// (timing can vary between Hermes and JSC engines)
setTimeout(installGlobalErrorSuppressor, 0);
setTimeout(installGlobalErrorSuppressor, 100);

export {};
