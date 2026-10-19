# CallFar: Mobile Application Testing & Verification Guide

This guide describes how to run and test **CallFar** on Android devices, emulators, and between multiple clients.

---

## 📱 1. Testing with Android Emulator (Android Studio)

1. Launch Android Studio and start any Android Virtual Device (AVD) running **Android 12+ (API 31+)**.
2. Make sure the backend server is running in another terminal (`npm run dev` in `callfar-backend`).
   * The mobile client connects to `http://10.0.2.2:5000/api/v1` automatically when running on Android emulators.
3. In `callfar-mobile`:
   ```powershell
   npx expo run:android
   ```
4. Once the app starts:
   * Log in with test account:
     * **Username:** `alice`
     * **Password:** `Password123!`

---

## 🔌 2. Testing with Physical Phone via USB Debugging (Recommended)

When testing on a real phone connected via USB cable:

1. **Enable USB Debugging on your phone:**
   * Go to **Settings > About Phone** -> Tap **Build Number** 7 times to enable Developer Options.
   * Go to **Settings > System > Developer Options** -> Enable **USB Debugging**.
   * Connect your phone to your computer via USB. Tap **"Always allow from this computer"** when prompted.
2. **Reverse ports over the USB cable:**
   Run in `callfar-mobile`:
   ```powershell
   npm run reverse
   ```
   *(This maps the phone's port 5000 and 8081 directly to your laptop over the USB cable!)*
3. **Start the backend server:**
   In `callfar-backend`:
   ```powershell
   npm run dev
   ```
4. **Start the mobile development bundler:**
   In `callfar-mobile`:
   ```powershell
   npm run start:usb
   ```
   * Press `a` to open on your connected phone, or launch the **CallFar** app on your phone.
5. **Log in and test:**
   * Log in with test account:
     * **Username:** `alice` (or `bob`)
     * **Password:** `Password123!`

---

## 👥 3. Testing Two-Device Real-Time Calling (Alice & Bob)

To test an actual live call between two devices:

### Scenario A: Emulator + Physical Android Phone (Same Wi-Fi)
1. Find your Windows computer's local IP address (e.g. `192.168.1.50`):
   ```powershell
   ipconfig
   ```
2. In `callfar-mobile/src/api/client.ts`, set the physical device API endpoint to your computer's IP:
   ```typescript
   export const API_BASE_URL = 'http://192.168.1.50:5000/api/v1';
   export const SOCKET_URL = 'http://192.168.1.50:5000';
   ```
3. Run Device 1 (Emulator):
   * Log in as `alice`.
4. Run Device 2 (Physical Device via USB cable or wireless ADB):
   * Log in as `bob`.
5. On Alice's screen:
   * Tap on **Contacts** -> Find **Bob Smith** -> Tap **Voice Call** or **Video Call**.
6. On Bob's screen:
   * The **Incoming Call Modal** pops up with ringing notification.
   * Tap **Accept**.
7. The active WebRTC call connects with audio/video streaming, timer, and controls. Tap **End** to terminate.
