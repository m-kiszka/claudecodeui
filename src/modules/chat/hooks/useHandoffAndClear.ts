import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/shared/api';
import type { ChatMessage } from '@/shared/types';

export type HandoffPhase = 'idle' | 'handoff' | 'resuming';

type UseHandoffAndClearArgs = {
  sessionId: string | null;
  isProcessing: boolean;
  chatMessages: ChatMessage[];
  sendPrompt: (text: string) => void;
};

/** The resume line the handoff skill prints, e.g. `/handoff 2026-10-14-0104-slug-<id>`. */
const HANDOFF_ID_PATTERN = /\/handoff\s+(\d{4}-\d{2}-\d{2}-\d{4}-[A-Za-z0-9._-]+)/;

/** A just-finished run can still be winding down server-side; retry the clear for about 30 s. */
const CLEAR_RETRY_DELAY_MS = 3_000;
const CLEAR_MAX_ATTEMPTS = 10;

/**
 * Clears the session's context, retrying while the server still reports the
 * session busy. Resolves to an error message for the user, or null.
 */
async function clearContextWithRetry(sessionId: string): Promise<string | null> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await api.clearSessionContext(sessionId);
    if (response.ok) return null;

    const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string } | string } | null;
    const error = payload?.error;
    const code = typeof error === 'object' ? error?.code : undefined;
    if (code === 'SESSION_BUSY' && attempt < CLEAR_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, CLEAR_RETRY_DELAY_MS));
      continue;
    }
    const reason = typeof error === 'string' ? error : error?.message;
    return `Clearing the context failed: ${reason ?? `HTTP ${response.status}`}`;
  }
}

function findHandoffId(messages: ChatMessage[], fromIndex: number): string | null {
  for (let index = messages.length - 1; index >= fromIndex; index -= 1) {
    const message = messages[index];
    if (message?.type !== 'assistant' || typeof message.content !== 'string') continue;
    const match = HANDOFF_ID_PATTERN.exec(message.content);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Used by ChatInterface for the composer's "hand off and clear" button: runs
 * `/handoff`, clears the session's context once that turn ends, and resumes
 * from the written handoff in the same session.
 */
export function useHandoffAndClear({ sessionId, isProcessing, chatMessages, sendPrompt }: UseHandoffAndClearArgs) {
  const [phase, setPhase] = useState<HandoffPhase>('idle');
  // The handoff turn counts as finished only after it was seen running.
  const sawRunRef = useRef(false);
  const startIndexRef = useRef(0);
  const sessionIdRef = useRef(sessionId);

  const start = useCallback(() => {
    if (!sessionId || isProcessing || phase !== 'idle') return;
    sessionIdRef.current = sessionId;
    sawRunRef.current = false;
    startIndexRef.current = chatMessages.length;
    setPhase('handoff');
    sendPrompt('/handoff');
  }, [chatMessages.length, isProcessing, phase, sendPrompt, sessionId]);

  useEffect(() => {
    if (phase === 'idle') return;
    // Switching sessions mid-way abandons the sequence.
    if (sessionId !== sessionIdRef.current) {
      setPhase('idle');
      return;
    }
    if (isProcessing) {
      sawRunRef.current = true;
      return;
    }
    // A short turn can start and end between two renders, so the written
    // handoff's resume line also counts as the end of the handoff turn.
    if (!sawRunRef.current) {
      if (phase !== 'handoff' || !findHandoffId(chatMessages, startIndexRef.current)) return;
    }

    if (phase === 'resuming') {
      setPhase('idle');
      return;
    }

    const targetSessionId = sessionIdRef.current;
    const handoffId = findHandoffId(chatMessages, startIndexRef.current);
    sawRunRef.current = false;
    setPhase('resuming');
    void (async () => {
      try {
        if (!targetSessionId) throw new Error('No session');
        const failure = await clearContextWithRetry(targetSessionId);
        if (failure) throw new Error(failure);
        sendPrompt(handoffId ? `/handoff ${handoffId}` : '/handoff');
      } catch (error) {
        console.error('Hand off and clear failed:', error);
        window.alert(error instanceof Error ? error.message : 'Hand off and clear failed.');
        setPhase('idle');
      }
    })();
  }, [chatMessages, isProcessing, phase, sendPrompt, sessionId]);

  /**
   * Clears the context and resumes from the latest handoff this conversation
   * wrote. Resolves to an error message for the user, or null on success.
   */
  const continueFromLatestHandoff = useCallback(async (): Promise<string | null> => {
    if (!sessionId) return 'There is no session to clear.';
    if (isProcessing || phase !== 'idle') return 'Wait for the current response to finish first.';
    const handoffId = findHandoffId(chatMessages, 0);
    if (!handoffId) return 'No handoff was written in this conversation yet. Run /handoff first.';

    // The resume turn ends the sequence, as after the button's own handoff.
    sessionIdRef.current = sessionId;
    sawRunRef.current = false;
    setPhase('resuming');
    const failure = await clearContextWithRetry(sessionId);
    if (failure) {
      setPhase('idle');
      return failure;
    }
    sendPrompt(`/handoff ${handoffId}`);
    return null;
  }, [chatMessages, isProcessing, phase, sendPrompt, sessionId]);

  /** The composer button for {@link continueFromLatestHandoff}; failures are shown to the user. */
  const continueFromHandoff = useCallback(() => {
    void continueFromLatestHandoff().then((failure) => {
      if (failure) window.alert(failure);
    });
  }, [continueFromLatestHandoff]);

  return { phase, start, continueFromLatestHandoff, continueFromHandoff };
}
