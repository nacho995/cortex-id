import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  private http = inject(HttpClient);

  readonly isListening = signal(false);
  readonly isSpeaking = signal(false);
  readonly transcript = signal('');
  readonly finalTranscript = signal('');
  readonly voiceResponseEnabled = signal(true);
  readonly error = signal('');
  readonly isProcessing = signal(false);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private _onEnd: (() => void) | null = null;

  set onEnd(cb: (() => void) | null) { this._onEnd = cb; }

  async startListening(): Promise<void> {
    this.error.set('');
    this.transcript.set('');
    this.finalTranscript.set('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        this.processAudio();
      };

      this.mediaRecorder.onerror = () => {
        this.error.set('Recording error');
        this.isListening.set(false);
        stream.getTracks().forEach(t => t.stop());
      };

      this.mediaRecorder.start(250);
      this.isListening.set(true);
      console.log('[Voice] Recording started');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        this.error.set('Microphone permission denied');
      } else if (err.name === 'NotFoundError') {
        this.error.set('No microphone found');
      } else {
        this.error.set('Mic error: ' + err.message);
      }
      this.isListening.set(false);
    }
  }

  stopListening(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
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

  private processAudio(): void {
    if (this.audioChunks.length === 0) return;

    this.isProcessing.set(true);
    this.transcript.set('Transcribing...');

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', 'es');

    this.http.post<{ text?: string; error?: string }>(
      'http://localhost:7432/api/whisper/transcribe',
      formData
    ).subscribe({
      next: (res) => {
        this.isProcessing.set(false);
        if (res.text) {
          console.log('[Voice] Transcribed:', res.text);
          this.finalTranscript.set(res.text);
          this.transcript.set(res.text);
        } else if (res.error) {
          this.error.set(res.error);
          this.transcript.set('');
        }
        const cb = this._onEnd;
        this._onEnd = null;
        cb?.();
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.error.set('Transcription failed. Check OpenAI API key in Settings.');
        this.transcript.set('');
        console.error('[Voice] Whisper API error:', err);
        const cb = this._onEnd;
        this._onEnd = null;
        cb?.();
      }
    });
  }

  private getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return 'audio/webm';
  }

  // Text-to-Speech
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
    u.lang = 'es-ES';
    u.rate = 1.05;
    const voices = this.synthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith('es') && v.localService) || voices.find(v => v.lang.startsWith('es'));
    if (v) u.voice = v;
    u.onstart = () => this.isSpeaking.set(true);
    u.onend = () => this.isSpeaking.set(false);
    u.onerror = () => this.isSpeaking.set(false);
    this.synthesis.speak(u);
  }

  stopSpeaking(): void { this.synthesis?.cancel(); this.isSpeaking.set(false); }
}
