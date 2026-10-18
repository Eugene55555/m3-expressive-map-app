/**
 * Minimal Web Speech API wrapper. The API is non-standard and absent in many
 * browsers, so everything here degrades to `null` and the UI offers an
 * explanation instead of a dead control.
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  results: {
    readonly length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as WindowWithSpeech;
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getConstructor() !== null;
}

export interface SpeechHandlers {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

export interface SpeechSession {
  stop(): void;
}

function friendlySpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow it in your browser to search by voice.';
    case 'no-speech':
      return 'No speech was detected. Try again.';
    case 'audio-capture':
      return 'No microphone was found.';
    case 'network':
      return 'Voice search needs a network connection in this browser.';
    case 'aborted':
      return 'Voice search was stopped.';
    default:
      return 'Voice search could not start.';
  }
}

/**
 * Start a single dictation session. Returns `null` when the browser has no
 * Web Speech API, or when the session could not be started at all (an error
 * has already been reported through `onError` in that case). The session ends
 * on its own after a result or an error.
 */
export function startSpeechRecognition(handlers: SpeechHandlers, lang?: string): SpeechSession | null {
  const Constructor = getConstructor();
  if (!Constructor) return null;

  const recognition = new Constructor();
  recognition.lang = lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    handlers.onEnd();
  };

  recognition.onresult = (event) => {
    const results = event.results;
    let transcript = '';
    let isFinal = false;
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const alternative = result[0] ?? { transcript: '' };
      transcript += alternative.transcript;
      if (result.isFinal) isFinal = true;
    }
    handlers.onResult(transcript.trim(), isFinal);
  };
  recognition.onerror = (event) => {
    handlers.onError(friendlySpeechError(event.error));
  };
  recognition.onend = finish;

  try {
    recognition.start();
  } catch {
    handlers.onError('Voice search could not start.');
    finish();
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    },
  };
}
