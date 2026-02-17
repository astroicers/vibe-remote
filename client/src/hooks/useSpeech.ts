// useSpeech Hook - Voice input with Web Speech API

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isSpeechSupported,
  SpeechController,
  type SpeechState,
} from '../services/speech';

interface UseSpeechOptions {
  language?: string;
  onFinalResult?: (transcript: string) => void;
}

interface UseSpeechReturn {
  isSupported: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearTranscript: () => void;
}

export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const { language = 'en-US', onFinalResult } = options;

  const controllerRef = useRef<SpeechController | null>(null);
  const [state, setState] = useState<SpeechState>({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    isSpeaking: false,
  });

  const prevTranscriptRef = useRef('');

  // Initialize controller
  useEffect(() => {
    if (!isSpeechSupported()) {
      return;
    }

    controllerRef.current = new SpeechController(language);
    const unsubscribe = controllerRef.current.subscribe(setState);

    return () => {
      unsubscribe();
      controllerRef.current?.abort();
    };
  }, [language]);

  // Call onFinalResult when transcript changes
  useEffect(() => {
    if (state.transcript && state.transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = state.transcript;
      onFinalResult?.(state.transcript);
    }
  }, [state.transcript, onFinalResult]);

  const startListening = useCallback(() => {
    controllerRef.current?.start();
  }, []);

  const stopListening = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    controllerRef.current?.clearTranscript();
    prevTranscriptRef.current = '';
  }, []);

  return {
    isSupported: isSpeechSupported(),
    isListening: state.isListening,
    isSpeaking: state.isSpeaking,
    transcript: state.transcript,
    interimTranscript: state.interimTranscript,
    error: state.error,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
}
