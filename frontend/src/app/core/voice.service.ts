import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly isListening = signal(false);
  readonly isSpeaking = signal(false);
  readonly transcript = signal('');
  readonly voiceResponseEnabled = signal(true);

  private recognition: any = null;
  private synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

  startListening(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { console.warn('[Voice] Not supported'); return; }

    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = navigator.language || 'en-US';

    this.recognition.onstart = () => this.isListening.set(true);
    this.recognition.onend = () => this.isListening.set(false);
    this.recognition.onerror = () => this.isListening.set(false);
    this.recognition.onresult = (event: any) => {
      const t = Array.from(event.results as SpeechRecognitionResultList)
        .map((r: any) => r[0].transcript).join('');
      this.transcript.set(t);
    };
    this.recognition.start();
  }

  stopListening(): void { this.recognition?.stop(); this.isListening.set(false); }

  toggleListening(): void {
    this.isListening() ? this.stopListening() : this.startListening();
  }

  getFinalTranscript(): string {
    const t = this.transcript();
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
