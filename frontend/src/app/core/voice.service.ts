import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly isListening = signal(false);
  readonly isSpeaking = signal(false);
  /** Live preview: interim + final text (for display while recording). */
  readonly transcript = signal('');
  /** Accumulated final (committed) results only. */
  readonly finalTranscript = signal('');
  readonly voiceResponseEnabled = signal(true);

  private recognition: any = null;
  private synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private _onEnd: (() => void) | null = null;

  /** Register a one-shot callback invoked when recognition ends (naturally or via stop). */
  set onEnd(cb: (() => void) | null) { this._onEnd = cb; }

  startListening(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { console.warn('[Voice] Not supported'); return; }

    this.transcript.set('');
    this.finalTranscript.set('');

    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = navigator.language || 'en-US';

    this.recognition.onstart = () => this.isListening.set(true);
    this.recognition.onend = () => {
      this.isListening.set(false);
      const cb = this._onEnd;
      this._onEnd = null;
      cb?.();
    };
    this.recognition.onerror = () => this.isListening.set(false);
    this.recognition.onresult = (event: any) => {
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
    this.recognition.start();
  }

  stopListening(): void { this.recognition?.stop(); }

  toggleListening(): void {
    this.isListening() ? this.stopListening() : this.startListening();
  }

  getFinalTranscript(): string {
    const t = this.finalTranscript();
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
    u.lang = navigator.language || 'en-US';
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
