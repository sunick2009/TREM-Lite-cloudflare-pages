const LANG = 'zh-TW';

let _supported = false;
let _ready = false;
let _voice: SpeechSynthesisVoice | null = null;

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isReady(): boolean {
  return _ready;
}

function findVoice(): void {
  const voices = window.speechSynthesis.getVoices();
  _voice = voices.find((v) => v.lang === LANG || v.lang.startsWith('zh')) ?? voices[0] ?? null;
  if (voices.length) _ready = true;
}

export function init(): void {
  if (!isSupported()) return;
  _supported = true;
  findVoice();
  if (!_ready) {
    window.speechSynthesis.onvoiceschanged = () => {
      findVoice();
    };
  }
}

export function speak(text: string, queue = false): void {
  if (!_supported || !isSupported()) return;
  if (!queue) {
    window.speechSynthesis.cancel();
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  if (_voice) utterance.voice = _voice;
  window.speechSynthesis.speak(utterance);
}

export function cancel(): void {
  if (isSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  if (!isSupported()) return false;
  return window.speechSynthesis.speaking;
}
