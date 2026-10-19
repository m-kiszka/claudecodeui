import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import SettingsCard from '@/modules/settings/SettingsCard';
import SettingsRow from '@/modules/settings/SettingsRow';
import SettingsSection from '@/modules/settings/SettingsSection';
import SettingsToggle from '@/modules/settings/SettingsToggle';
import { useSetUiPreference, useUiPreferences } from '@/shared/context/UiPreferencesContext';
import {
  DEFAULT_RATE_LIMIT_CONTINUE_PROMPT,
  useRateLimitContinuePrompt,
  writeRateLimitContinuePrompt,
} from '@/shared/hooks/useRateLimitContinuePrompt';
import { Input } from '@/shared/ui';

/** Rendered by Settings for the "chat" tab, covering how the composer sends messages. */
export default function ChatSettingsTab() {
  const { t } = useTranslation('settings');
  const { queueInterrupts, handoffAndClear } = useUiPreferences();
  const setUiPreference = useSetUiPreference();
  const continuePrompt = useRateLimitContinuePrompt();
  // Held only while the field is being edited, and saved on blur or Enter
  // rather than on every keystroke; otherwise the stored prompt shows.
  const [continueDraft, setContinueDraft] = useState<string | null>(null);
  const saveContinuePrompt = () => {
    if (continueDraft !== null && continueDraft.trim() !== continuePrompt) {
      writeRateLimitContinuePrompt(continueDraft);
    }
    setContinueDraft(null);
  };

  return (
    <div className="space-y-8">
      <SettingsSection title={t('chatSettings.queue.title', { defaultValue: 'Queued messages' })}>
        <SettingsCard>
          <SettingsRow
            label={t('chatSettings.queue.interrupts', { defaultValue: 'Queued messages interrupt' })}
            description={t('chatSettings.queue.interruptsDescription', {
              defaultValue: 'A message sent while a response is running stops it and is sent right away, instead of waiting for it to finish.',
            })}
          >
            <SettingsToggle
              checked={queueInterrupts}
              onChange={(value) => setUiPreference('queueInterrupts', value)}
              ariaLabel={t('chatSettings.queue.interrupts', { defaultValue: 'Queued messages interrupt' })}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('chatSettings.context.title', { defaultValue: 'Context' })}>
        <SettingsCard>
          <SettingsRow
            label={t('chatSettings.context.handoffAndClear', { defaultValue: 'Hand off and clear button' })}
            description={t('chatSettings.context.handoffAndClearDescription', {
              defaultValue: 'Adds a composer button that runs /handoff, clears the context and resumes from the handoff in the same conversation.',
            })}
          >
            <SettingsToggle
              checked={handoffAndClear}
              onChange={(value) => setUiPreference('handoffAndClear', value)}
              ariaLabel={t('chatSettings.context.handoffAndClear', { defaultValue: 'Hand off and clear button' })}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('chatSettings.rateLimit.title', { defaultValue: 'Usage limits' })}>
        <SettingsCard>
          <SettingsRow
            label={t('chatSettings.rateLimit.continuePrompt', { defaultValue: 'Continue prompt' })}
            description={t('chatSettings.rateLimit.continuePromptDescription', {
              defaultValue: 'What Continue sends after a usage limit, now or when the limit resets. Leave empty for "{{fallback}}".',
              fallback: DEFAULT_RATE_LIMIT_CONTINUE_PROMPT,
            })}
          >
            <Input
              value={continueDraft ?? continuePrompt}
              onChange={(event) => setContinueDraft(event.target.value)}
              onBlur={saveContinuePrompt}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  saveContinuePrompt();
                }
              }}
              placeholder={DEFAULT_RATE_LIMIT_CONTINUE_PROMPT}
              aria-label={t('chatSettings.rateLimit.continuePrompt', { defaultValue: 'Continue prompt' })}
              className="w-48"
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
