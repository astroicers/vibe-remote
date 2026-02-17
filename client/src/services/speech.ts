// Speech Recognition Service using Web Speech API

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// Check if speech recognition is supported
export function isSpeechSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Speech recognition options
export interface SpeechOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

// Create a speech recognition instance
export function createSpeechRecognition(options: SpeechOptions = {}): SpeechRecognition | null {
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    console.warn('Speech recognition not supported');
    return null;
  }

  const recognition = new SpeechRecognitionAPI();

  // Configure
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.lang = options.language ?? 'en-US';
  recognition.maxAlternatives = options.maxAlternatives ?? 1;

  // Event handlers
  if (options.onStart) {
    recognition.onstart = options.onStart;
  }

  if (options.onEnd) {
    recognition.onend = options.onEnd;
  }

  if (options.onError) {
    recognition.onerror = (event) => {
      options.onError?.(event.error);
    };
  }

  if (options.onResult) {
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        options.onResult?.(finalTranscript, true);
      } else if (interimTranscript) {
        options.onResult?.(interimTranscript, false);
      }
    };
  }

  if (options.onSpeechStart) {
    recognition.onspeechstart = options.onSpeechStart;
  }

  if (options.onSpeechEnd) {
    recognition.onspeechend = options.onSpeechEnd;
  }

  return recognition;
}

// Speech recognition state
export interface SpeechState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSpeaking: boolean;
}

// Speech recognition controller
export class SpeechController {
  private recognition: SpeechRecognition | null = null;
  private state: SpeechState = {
    isListening: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    isSpeaking: false,
  };
  private listeners: Set<(state: SpeechState) => void> = new Set();

  constructor(language: string = 'en-US') {
    if (!isSpeechSupported()) {
      return;
    }

    this.recognition = createSpeechRecognition({
      language,
      continuous: false,
      interimResults: true,
      onResult: (transcript, isFinal) => {
        if (isFinal) {
          this.updateState({
            transcript: this.state.transcript + transcript,
            interimTranscript: '',
          });
        } else {
          this.updateState({
            interimTranscript: transcript,
          });
        }
      },
      onError: (error) => {
        this.updateState({
          error,
          isListening: false,
        });
      },
      onStart: () => {
        this.updateState({
          isListening: true,
          error: null,
        });
      },
      onEnd: () => {
        this.updateState({
          isListening: false,
        });
      },
      onSpeechStart: () => {
        this.updateState({
          isSpeaking: true,
        });
      },
      onSpeechEnd: () => {
        this.updateState({
          isSpeaking: false,
        });
      },
    });
  }

  private updateState(partial: Partial<SpeechState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: (state: SpeechState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): SpeechState {
    return this.state;
  }

  start(): boolean {
    if (!this.recognition) {
      this.updateState({ error: 'Speech recognition not supported' });
      return false;
    }

    if (this.state.isListening) {
      return true;
    }

    try {
      // Reset transcript when starting
      this.updateState({
        transcript: '',
        interimTranscript: '',
        error: null,
      });
      this.recognition.start();
      return true;
    } catch (error) {
      this.updateState({ error: 'Failed to start recognition' });
      return false;
    }
  }

  stop(): void {
    if (this.recognition && this.state.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore errors when stopping
      }
    }
  }

  abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore errors when aborting
      }
      this.updateState({
        isListening: false,
        isSpeaking: false,
      });
    }
  }

  clearTranscript(): void {
    this.updateState({
      transcript: '',
      interimTranscript: '',
    });
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }
}

// Singleton instance
let speechController: SpeechController | null = null;

export function getSpeechController(language?: string): SpeechController {
  if (!speechController) {
    speechController = new SpeechController(language);
  }
  return speechController;
}
