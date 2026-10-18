/**
 * Model families, in the spelling they are shown in. The provider reports a
 * full id (`claude-opus-5`, `claude-haiku-4-5-20251001`); the footer has room
 * for the family, and the exact id stays in the tooltip.
 */
const MODEL_FAMILY_LABELS: ReadonlyArray<readonly [token: string, label: string]> = [
  ['opus', 'Opus'],
  ['sonnet', 'Sonnet'],
  ['haiku', 'Haiku'],
  ['fable', 'Fable'],
];

/**
 * Shortens a reported model id to the label shown under a reply, or `null`
 * when there is nothing to show. Used by chat's MessageModelLabel.
 *
 * An id from no known family is shown verbatim rather than dropped, so an
 * unrecognized model still reports itself honestly. A `[1m]` suffix is kept as
 * "1M" instead of being folded into the base family: Claude Code writes the
 * base id on assistant rows today, but if a provider ever reports the 1M
 * variant it must not read as the 200K one.
 */
export const formatAnsweringModelLabel = (model: string | undefined): string | null => {
  const reportedModel = model?.trim();
  if (!reportedModel) {
    return null;
  }

  const normalized = reportedModel.toLowerCase();
  const family = MODEL_FAMILY_LABELS.find(([token]) => normalized.includes(token));
  if (!family) {
    return reportedModel;
  }

  return normalized.endsWith('[1m]') ? `${family[1]} 1M` : family[1];
};

/**
 * A Claude model id in the spelling the model menu shows: `claude-opus-5-5`
 * reads "Opus 5.5", `claude-haiku-4-5-20251001` "Haiku 4.5", and a `[1m]`
 * suffix "(1M context)" as the catalog writes it. Returns `null` for an id
 * that is not a versioned Claude id, so the caller can fall back to it.
 */
export const formatClaudeModelName = (model: string | undefined): string | null => {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/i.exec(model?.trim() ?? '');
  if (!match) {
    return null;
  }
  const [, familyToken, major, minor, oneMillion] = match;
  const family = MODEL_FAMILY_LABELS.find(([token]) => token === familyToken.toLowerCase())?.[1]
    ?? `${familyToken[0].toUpperCase()}${familyToken.slice(1)}`;
  const version = minor ? `${major}.${minor}` : major;
  return `${family} ${version}${oneMillion ? ' (1M context)' : ''}`;
};

/** The version part of a Claude model id ("5.5" for `claude-opus-5-5`), or `null`. */
export const readClaudeModelVersion = (model: string | undefined): { family: string; version: string } | null => {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[1m\])?$/i.exec(model?.trim() ?? '');
  if (!match) {
    return null;
  }
  return { family: match[1].toLowerCase(), version: match[3] ? `${match[2]}.${match[3]}` : match[2] };
};
