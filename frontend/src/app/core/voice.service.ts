import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly isListening = signal(false);
  readonly isSpeaking = signal(false);
  readonly transcript = signal('');
  readonly finalTranscript = signal('');
  readonly voiceResponseEnabled = signal(true);
  readonly error = signal('');
  readonly isProcessing = signal(false);
  readonly modelStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private whisperPipeline: any = null;
  private synthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private _onEnd: (() => void) | null = null;

  set onEnd(cb: (() => void) | null) { this._onEnd = cb; }

  /** Load the Whisper model (first time downloads ~75MB, then cached) */
  async loadModel(): Promise<void> {
    if (this.whisperPipeline) return;
    if (this.modelStatus() === 'loading') return;

    this.modelStatus.set('loading');
    this.error.set('');

    try {
      // Dynamic import to avoid loading the library at startup
      const { pipeline } = await import('@huggingface/transformers');

      console.log('[Voice] Loading Whisper model (first time may take a minute)...');
      this.whisperPipeline = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',  // ~40MB, fast
        {
          dtype: 'fp32',
          device: 'wasm',
        }
      );

      this.modelStatus.set('ready');
      console.log('[Voice] Whisper model loaded successfully');
    } catch (err: any) {
      console.error('[Voice] Failed to load Whisper model:', err);
      this.modelStatus.set('error');
      this.error.set('Failed to load speech model: ' + err.message);
    }
  }

  /** Start recording audio from microphone */
  async startListening(): Promise<void> {
    this.error.set('');
    this.transcript.set('');
    this.finalTranscript.set('');

    // Load model if not ready
    if (!this.whisperPipeline) {
      await this.loadModel();
      if (!this.whisperPipeline) return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Process the recorded audio
        await this.processAudio();
      };

      this.mediaRecorder.onerror = (event: any) => {
        this.error.set('Recording error: ' + (event.error?.message || 'unknown'));
        this.isListening.set(false);
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(250); // Collect data every 250ms
      this.isListening.set(true);
      console.log('[Voice] Recording started');

    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        this.error.set('Microphone permission denied. Allow it in system settings.');
      } else if (err.name === 'NotFoundError') {
        this.error.set('No microphone found.');
      } else {
        this.error.set('Microphone error: ' + err.message);
      }
      this.isListening.set(false);
    }
  }

  /** Stop recording and process audio */
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

  /** Process recorded audio through Whisper */
  private async processAudio(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    this.isProcessing.set(true);
    this.transcript.set('Processing speech...');

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

      // Convert blob to Float32Array for Whisper
      const audioBuffer = await this.blobToAudioBuffer(audioBlob);

      if (!this.whisperPipeline) {
        this.error.set('Whisper model not loaded');
        return;
      }

      console.log('[Voice] Transcribing audio...');
      const result = await this.whisperPipeline(audioBuffer, {
        language: 'spanish',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      const text = result.text?.trim() || '';
      console.log('[Voice] Transcription:', text);

      this.finalTranscript.set(text);
      this.transcript.set(text);

      // Trigger onEnd callback
      const cb = this._onEnd;
      this._onEnd = null;
      cb?.();

    } catch (err: any) {
      console.error('[Voice] Transcription failed:', err);
      this.error.set('Transcription failed: ' + err.message);
    } finally {
      this.isProcessing.set(false);
    }
  }

  /** Convert audio Blob to Float32Array for Whisper */
  private async blobToAudioBuffer(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });

    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0); // Mono

    // Resample to 16kHz if needed
    if (audioBuffer.sampleRate !== 16000) {
      const ratio = 16000 / audioBuffer.sampleRate;
      const newLength = Math.round(channelData.length * ratio);
      const resampled = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        const srcIndex = i / ratio;
        const lower = Math.floor(srcIndex);
        const upper = Math.min(lower + 1, channelData.length - 1);
        const frac = srcIndex - lower;
        resampled[i] = channelData[lower] * (1 - frac) + channelData[upper] * frac;
      }
      await audioContext.close();
      return resampled;
    }

    await audioContext.close();
    return channelData;
  }

  private getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
  }

  // ── Text-to-Speech (stays the same) ──

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
