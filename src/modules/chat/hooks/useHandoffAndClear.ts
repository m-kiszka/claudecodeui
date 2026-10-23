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
    if (!sawRunRef.current) return;

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
        const response = await api.clearSessionContext(targetSessionId);
        if (!response.ok) throw new Error(`Clearing the context failed (${response.status})`);
        sendPrompt(handoffId ? `/handoff ${handoffId}` : '/handoff');
      } catch (error) {
        console.error('Hand off and clear failed:', error);
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
    if (isProcessing) return 'Wait for the current response to finish first.';
    const handoffId = findHandoffId(chatMessages, 0);
    if (!handoffId) return 'No handoff was written in this conversation yet. Run /handoff first.';

    const response = await api.clearSessionContext(sessionId);
    if (!response.ok) return `Clearing the context failed (${response.status}).`;
    sendPrompt(`/handoff ${handoffId}`);
    return null;
  }, [chatMessages, isProcessing, sendPrompt, sessionId]);

  return { phase, start, continueFromLatestHandoff };
}
