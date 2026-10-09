import { useTranslation } from 'react-i18next';

import SettingsCard from '@/modules/settings/SettingsCard';
import SettingsRow from '@/modules/settings/SettingsRow';
import SettingsSection from '@/modules/settings/SettingsSection';
import SettingsToggle from '@/modules/settings/SettingsToggle';
import { useSetUiPreference, useUiPreferences } from '@/shared/context/UiPreferencesContext';

/** Rendered by Settings for the "chat" tab, covering how the composer sends messages. */
export default function ChatSettingsTab() {
  const { t } = useTranslation('settings');
  const { queueInterrupts } = useUiPreferences();
  const setUiPreference = useSetUiPreference();

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
    </div>
  );
}
