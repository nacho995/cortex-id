import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly isListening = signal(false);
  readonly isSpeaking = signal(false);
  readonly transcript = signal('');
  readonly finalTranscript = signal('');
  readonly voiceResponseEnabled = signal(true);
  readonly error = signal('');

  private recognition: any = null;
  private synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private _onEnd: (() => void) | null = null;

  set onEnd(cb: (() => void) | null) { this._onEnd = cb; }

  startListening(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      this.error.set('Speech recognition not available in this browser');
      return;
    }

    // Stop any existing session
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
      this.recognition = null;
    }

    this.transcript.set('');
    this.finalTranscript.set('');
    this.error.set('');

    const recognition = new SR();
    recognition.continuous = true;        // Keep listening until user stops
    recognition.interimResults = true;     // Show live text while speaking
    recognition.maxAlternatives = 1;
    recognition.lang = navigator.language || 'es-ES';

    recognition.onstart = () => {
      this.isListening.set(true);
      this.error.set('');
      console.log('[Voice] Started listening');
    };

    recognition.onend = () => {
      console.log('[Voice] Ended');
      this.isListening.set(false);
      const cb = this._onEnd;
      this._onEnd = null;
      cb?.();

      // If continuous and still supposed to be listening, restart
      // (some browsers stop after silence even with continuous:true)
    };

    recognition.onerror = (event: any) => {
      const errorType = event.error || 'unknown';
      console.error('[Voice] Error:', errorType);

      switch (errorType) {
        case 'no-speech':
          // User didn't speak — not a real error, restart
          this.error.set('No speech detected. Try again.');
          break;
        case 'audio-capture':
          this.error.set('No microphone found. Check permissions.');
          break;
        case 'not-allowed':
          this.error.set('Microphone permission denied.');
          break;
        case 'network':
          this.error.set('Network error. Speech recognition requires internet.');
          break;
        case 'service-not-allowed':
          this.error.set('Speech service not available. Try Chrome or Edge.');
          break;
        default:
          this.error.set('Voice error: ' + errorType);
      }

      this.isListening.set(false);
    };

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      this.finalTranscript.set(final);
      this.transcript.set(final + interim);
    };

    this.recognition = recognition;

    try {
      recognition.start();
    } catch (e: any) {
      this.error.set('Could not start voice: ' + e.message);
      this.isListening.set(false);
    }
  }

  stopListening(): void {
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
      this.recognition = null;
    }
    this.isListening.set(false);
  }

  toggleListening(): void {
    this.isListening() ? this.stopListening() : this.startListening();
  }

  getFinalTranscript(): string {
    const t = this.finalTranscript() || this.transcript();
    this.finalTranscript.set('');
    this.transcript.set('');
    return t;
  }

  speak(text: string): void {
    if (!this.synthesis || !this.voiceResponseEnabled()) return;
    this.synthesis.cancel();
    const clean = text
      .replace(/```[\s\S]*?```/g, '... code block ...')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~\[\]]/g, '')
      .replace(/\n{2,}/g, '. ').trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = navigator.language || 'es-ES';
    u.rate = 1.05;
    const voices = this.synthesis.getVoices();
    const lang = u.lang.split('-')[0];
    const v = voices.find(v => v.lang.startsWith(lang) && v.localService) || voices.find(v => v.lang.startsWith(lang));
    if (v) u.voice = v;
    u.onstart = () => this.isSpeaking.set(true);
    u.onend = () => this.isSpeaking.set(false);
    u.onerror = () => this.isSpeaking.set(false);
    this.synthesis.speak(u);
  }

  stopSpeaking(): void { this.synthesis?.cancel(); this.isSpeaking.set(false); }
}
