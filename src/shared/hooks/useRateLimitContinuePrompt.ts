import { useSyncExternalStore } from 'react';

import { readUserPreference, subscribeToUserPreferences, writeUserPreference } from '@/shared/userSettings';

/** What Continue sends when the user has not chosen their own prompt. */
export const DEFAULT_RATE_LIMIT_CONTINUE_PROMPT = 'Continue';

/** The stored prompt, or the default when none is set or it is blank. */
export function readRateLimitContinuePrompt(): string {
  const stored = readUserPreference<unknown>('rateLimitContinuePrompt', '');
  return typeof stored === 'string' && stored.trim() ? stored.trim() : DEFAULT_RATE_LIMIT_CONTINUE_PROMPT;
}

/** Stores the prompt; a blank one goes back to the default. */
export function writeRateLimitContinuePrompt(prompt: string): void {
  writeUserPreference('rateLimitContinuePrompt', prompt.trim());
}

/**
 * The prompt the chat's Continue sends after a usage limit, kept current
 * when it changes in Settings or on another device.
 */
export function useRateLimitContinuePrompt(): string {
  return useSyncExternalStore(subscribeToUserPreferences, readRateLimitContinuePrompt, readRateLimitContinuePrompt);
}
