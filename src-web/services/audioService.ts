import { getConfig } from './configStore.ts';

type AudioKey =
  | 'ALERT' | 'EEW' | 'INTENSITY' | 'PGA1' | 'PGA2'
  | 'REPORT' | 'SHINDO0' | 'SHINDO1' | 'SHINDO2'
  | 'TSUNAMI' | 'UPDATE' | 'CANCEL';

const AUDIO_FILES: Record<AudioKey, string> = {
  ALERT: '/audio/ALERT.mp3',
  EEW: '/audio/EEW.mp3',
  INTENSITY: '/audio/INTENSITY.mp3',
  PGA1: '/audio/PGA1.mp3',
  PGA2: '/audio/PGA2.mp3',
  REPORT: '/audio/REPORT.mp3',
  SHINDO0: '/audio/SHINDO0.mp3',
  SHINDO1: '/audio/SHINDO1.mp3',
  SHINDO2: '/audio/SHINDO2.mp3',
  TSUNAMI: '/audio/TSUNAMI.mp3',
  UPDATE: '/audio/UPDATE.mp3',
  CANCEL: '/audio/CANCEL.mp3',
};

const AUDIO_VOLUME: Partial<Record<AudioKey, number>> = {
  SHINDO0: 0.4,
  UPDATE: 0.2,
};

class AudioQueue {
  private queue: HTMLAudioElement[] = [];
  private playing = false;
  private audioName: (a: HTMLAudioElement) => string | null;

  constructor(audioName: (a: HTMLAudioElement) => string | null) {
    this.audioName = audioName;
  }

  add(audio: HTMLAudioElement, rules: Record<string, string[]> = {}): void {
    const name = this.audioName(audio);
    if (name && rules[name]) {
      this.queue = this.queue.filter((q) => {
        const qName = this.audioName(q);
        return qName ? !rules[name].includes(qName) : true;
      });
    }
    if (name === 'ALERT') {
      this.queue.push(audio, audio);
    } else {
      this.queue.push(audio);
    }
    this.playNext();
  }

  private playNext(): void {
    if (this.playing || !this.queue.length) return;
    this.playing = true;
    const audio = this.queue.shift()!;
    audio.pause();
    audio.currentTime = 0;
    audio.play()
      .then(() => {
        audio.onended = () => {
          this.playing = false;
          this.playNext();
        };
      })
      .catch((e) => {
        console.warn('[Audio] play failed:', e.message ?? e);
        this.playing = false;
        this.playNext();
      });
  }

  clear(): void {
    this.queue = [];
    this.playing = false;
  }
}

export class AudioManager {
  private static _instance: AudioManager | null = null;
  private audios: Map<AudioKey, HTMLAudioElement> = new Map();
  private unlocked = false;
  private queues: Record<string, AudioQueue>;

  private constructor() {
    this.queues = {
      eew: new AudioQueue((a) => this.getName(a)),
      pga: new AudioQueue((a) => this.getName(a)),
      shindo: new AudioQueue((a) => this.getName(a)),
      update: new AudioQueue((a) => this.getName(a)),
    };
    this.preload();
  }

  static getInstance(): AudioManager {
    if (!AudioManager._instance) AudioManager._instance = new AudioManager();
    return AudioManager._instance;
  }

  private preload(): void {
    for (const [key, src] of Object.entries(AUDIO_FILES) as Array<[AudioKey, string]>) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      const vol = AUDIO_VOLUME[key];
      if (vol !== undefined) audio.volume = vol;
      this.audios.set(key, audio);
    }
  }

  private getName(audio: HTMLAudioElement): string | null {
    for (const [key, a] of this.audios.entries()) {
      if (a === audio) return key;
    }
    return null;
  }

  private get(key: AudioKey): HTMLAudioElement | undefined {
    return this.audios.get(key);
  }

  /** Call once after user gesture to unlock autoplay */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    // Play a silent audio to unlock iOS/Safari autoplay
    const ctx = new AudioContext();
    ctx.resume().then(() => ctx.close()).catch(() => undefined);
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  private soundEnabled(key: string): boolean {
    return getConfig().notification.soundEffects[key] !== false;
  }

  playEewRelease(status: number): void {
    if (status === 1) {
      if (this.soundEnabled('EEW2')) {
        const a = this.get('ALERT');
        if (a) this.queues.eew.add(a, { ALERT: ['EEW'] });
      }
    } else {
      if (this.soundEnabled('EEW')) {
        const a = this.get('EEW');
        if (a) this.queues.eew.add(a, { ALERT: ['EEW'] });
      }
    }
  }

  playEewAlert(): void {
    if (this.soundEnabled('EEW2')) {
      const a = this.get('ALERT');
      if (a) this.queues.eew.add(a, { ALERT: ['EEW'] });
    }
  }

  playEewUpdate(): void {
    this.queues.update.clear();
    if (this.soundEnabled('Update')) {
      const a = this.get('UPDATE');
      if (a) this.queues.update.add(a);
    }
  }

  playEewCancel(): void {
    const a = this.get('CANCEL');
    if (a) this.queues.eew.add(a);
  }

  playRtsPga1(): void {
    if (this.soundEnabled('PGA1')) {
      const a = this.get('PGA1');
      if (a) this.queues.pga.add(a, { PGA2: ['PGA1'] });
    }
  }

  playRtsPga2(): void {
    if (this.soundEnabled('PGA2')) {
      const a = this.get('PGA2');
      if (a) this.queues.pga.add(a, { PGA2: ['PGA1'] });
    }
  }

  playRtsShindo0(): void {
    if (this.soundEnabled('Shindo0')) {
      const a = this.get('SHINDO0');
      if (a) this.queues.shindo.add(a);
    }
  }

  playRtsShindo1(): void {
    if (this.soundEnabled('Shindo1')) {
      const a = this.get('SHINDO1');
      if (a) this.queues.shindo.add(a, { SHINDO2: ['SHINDO1'], SHINDO1: ['SHINDO0'] });
    }
  }

  playRtsShindo2(): void {
    if (this.soundEnabled('Shindo2')) {
      const a = this.get('SHINDO2');
      if (a) this.queues.shindo.add(a, { SHINDO2: ['SHINDO1'], SHINDO1: ['SHINDO0'] });
    }
  }

  playReport(): void {
    if (this.soundEnabled('Report')) {
      const a = this.get('REPORT');
      a?.play().catch(() => undefined);
    }
  }

  playIntensity(): void {
    if (this.soundEnabled('PAlert')) {
      const a = this.get('INTENSITY');
      a?.play().catch(() => undefined);
    }
  }

  playTsunami(): void {
    const a = this.get('TSUNAMI');
    a?.play().catch(() => undefined);
  }
}
