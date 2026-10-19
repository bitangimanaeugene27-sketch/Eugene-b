import { Vibration, Platform } from 'react-native';

// Dynamic import handling for expo-av and expo-speech
let Audio: any = null;
let Speech: any = null;

try {
  Audio = require('expo-av').Audio;
} catch {
  // Graceful fallback if native module is compiling
}

try {
  Speech = require('expo-speech');
} catch {
  // Graceful fallback if native module is compiling
}

// ─── Pure Offline Tone Synthesis (PCM WAV base64) ─────────────────────────────
// Generates standard 16-bit 8000Hz mono WAV data URI for telecom tones
function generateToneWavUri(
  freq1: number,
  freq2: number,
  durationSec: number,
  cycleOnSec = 2,
  cycleOffSec = 3
): string {
  const sampleRate = 8000;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  const cycleLen = cycleOnSec + cycleOffSec;
  let offset = 44;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const posInCycle = t % cycleLen;

    let sampleVal = 0;
    if (posInCycle < cycleOnSec) {
      // Generate dual frequency sine wave with smooth attack/decay
      const s1 = Math.sin(2 * Math.PI * freq1 * t);
      const s2 = freq2 > 0 ? Math.sin(2 * Math.PI * freq2 * t) : 0;
      const combined = freq2 > 0 ? (s1 + s2) * 0.45 : s1 * 0.8;
      sampleVal = Math.floor(combined * 32767);
    }

    view.setInt16(offset, Math.max(-32768, Math.min(32767, sampleVal)), true);
    offset += 2;
  }

  // Base64 encoding
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  if (typeof btoa !== 'undefined') {
    return `data:audio/wav;base64,${btoa(binary)}`;
  }

  // Pure JS base64 fallback
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  let i = 0;
  while (i < len) {
    const b1 = bytes[i++];
    const b2 = i < len ? bytes[i++] : NaN;
    const b3 = i < len ? bytes[i++] : NaN;
    base64 += chars[b1 >> 2];
    base64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    base64 += isNaN(b2) ? '=' : chars[((b2 & 15) << 2) | (b3 >> 6)];
    base64 += isNaN(b3) ? '=' : chars[b3 & 63];
  }

  return `data:audio/wav;base64,${base64}`;
}

// Pre-computed telecom tone data URIs
const RINGBACK_TONE_URI = generateToneWavUri(440, 480, 5, 2.0, 3.0); // US standard ringback: 440+480Hz
const RINGTONE_URI = generateToneWavUri(523, 659, 4, 1.2, 1.0); // Melodic phone chime: C5 + E5
const CONNECTED_CHIME_URI = generateToneWavUri(587, 880, 0.45, 0.45, 0); // 587Hz -> 880Hz upbeat chime
const DISCONNECT_TONE_URI = generateToneWavUri(480, 620, 1.5, 0.4, 0.35); // Busy disconnect beep: 480+620Hz

class SoundManager {
  private activeSound: any = null;
  private isLooping = false;
  private vibrationInterval: any = null;

  constructor() {
    this.configureAudioSession();
  }

  private async configureAudioSession() {
    if (Audio?.setAudioModeAsync) {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.warn('[SoundManager] AudioMode configure notice:', e);
      }
    }
  }

  /**
   * Switch audio session to CALL mode when a WebRTC call connects.
   * This routes microphone input + WebRTC audio output through the earpiece
   * (or speakerphone if user selects it) on Android and iOS.
   * MUST be called right when the call is accepted / connected.
   */
  async switchToCallAudio(useSpeaker = false) {
    if (Audio?.setAudioModeAsync) {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          // false = earpiece (private call), true = speakerphone
          playThroughEarpieceAndroid: !useSpeaker,
        });
        console.log('[SoundManager] Audio switched to CALL mode. Speaker:', useSpeaker);
      } catch (e) {
        console.warn('[SoundManager] switchToCallAudio error:', e);
      }
    }
  }

  /**
   * Restore audio session to MEDIA mode after a call ends.
   * Routes audio back to speaker (normal media playback).
   */
  async switchToMediaAudio() {
    if (Audio?.setAudioModeAsync) {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.log('[SoundManager] Audio restored to MEDIA mode.');
      } catch (e) {
        console.warn('[SoundManager] switchToMediaAudio error:', e);
      }
    }
  }

  /**
   * Play Outgoing Ringback Tone ("tuuuut... tuuuut...")
   * When caller is waiting for the receiver to answer
   */
  async playRingback() {
    this.stopAll();
    this.isLooping = true;

    // Start subtle pulse vibration
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate([0, 600, 2400], true);
      } catch {}
    }

    if (Audio?.Sound) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: RINGBACK_TONE_URI },
          { shouldPlay: true, isLooping: true, volume: 0.85 }
        );
        this.activeSound = sound;
      } catch (e) {
        console.warn('[SoundManager] Ringback play notice:', e);
      }
    }
  }

  /**
   * Play Incoming Ringtone
   * When the user's phone is receiving an incoming call
   */
  async playRingtone() {
    this.stopAll();
    this.isLooping = true;

    // Strong rhythmic incoming call vibration
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate([0, 1000, 800], true);
      } catch {}
    }

    if (Audio?.Sound) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: RINGTONE_URI },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        this.activeSound = sound;
      } catch (e) {
        console.warn('[SoundManager] Ringtone play notice:', e);
      }
    }
  }

  /**
   * Play Call Connected Chime
   */
  async playCallConnected() {
    this.stopAll();

    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(80);
      } catch {}
    }

    if (Audio?.Sound) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: CONNECTED_CHIME_URI },
          { shouldPlay: true, isLooping: false, volume: 0.9 }
        );
        setTimeout(async () => {
          try {
            await sound.unloadAsync();
          } catch {}
        }, 1200);
      } catch {}
    }
  }

  /**
   * Play Disconnect / Call Ended Tone ("beep-beep-beep")
   */
  async playCallEnded() {
    this.stopAll();

    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate([0, 100, 100, 100]);
      } catch {}
    }

    if (Audio?.Sound) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: DISCONNECT_TONE_URI },
          { shouldPlay: true, isLooping: false, volume: 0.75 }
        );
        setTimeout(async () => {
          try {
            await sound.unloadAsync();
          } catch {}
        }, 2000);
      } catch {}
    }
  }

  /**
   * Speak text using Native Text-To-Speech (TTS)
   * Used for the Self-Call Voice Test Assistant & Echo Bot
   */
  async speak(text: string, onDone?: () => void) {
    this.stopSpeech();

    if (Speech?.speak) {
      try {
        Speech.speak(text, {
          language: 'en-US',
          pitch: 1.02,
          rate: 0.94,
          onDone: () => {
            if (onDone) onDone();
          },
          onError: (err: any) => {
            console.warn('[SoundManager] Speech notice:', err);
            if (onDone) onDone();
          },
        });
        return;
      } catch (e) {
        console.warn('[SoundManager] Speech init error:', e);
      }
    }

    // If Speech native module not linked yet, invoke callback after simulated duration
    if (onDone) {
      const simulatedDurationMs = Math.min(10000, Math.max(2500, text.split(' ').length * 280));
      setTimeout(onDone, simulatedDurationMs);
    }
  }

  /**
   * Stop active speech
   */
  stopSpeech() {
    if (Speech?.stop) {
      try {
        Speech.stop();
      } catch {}
    }
  }

  /**
   * Stop all active sounds, ringtones, vibrations, and speech
   */
  async stopAll() {
    this.isLooping = false;
    this.stopSpeech();

    if (Platform.OS !== 'web') {
      try {
        Vibration.cancel();
      } catch {}
    }

    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }

    if (this.activeSound) {
      const s = this.activeSound;
      this.activeSound = null;
      try {
        await s.stopAsync();
        await s.unloadAsync();
      } catch {}
    }
  }
}

export const soundManager = new SoundManager();
export default soundManager;
