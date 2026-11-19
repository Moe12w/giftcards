// src/components/ShowMore.tsx
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';

/**
 * Keeps a long list short until the customer asks for the rest.
 * `visible` is what the screen should render; `hasMore` guards the button so a
 * short list never shows a control that does nothing.
 */
export function usePaged<T>(items: T[], initial = 4) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initial);
  const toggle = useCallback(() => setExpanded((value) => !value), []);
  const reset = useCallback(() => setExpanded(false), []);

  return { visible, expanded, hasMore: items.length > initial, toggle, reset };
}

interface ShowMoreProps {
  expanded: boolean;
  onPress: () => void;
  label?: string;
  lessLabel?: string;
}

/** Website-style pill button used under a collapsed list. */
export function ShowMore({ expanded, onPress, label, lessLabel }: ShowMoreProps) {
  const { t } = useTranslation();
  return (
    <Button
      label={expanded ? lessLabel ?? t('common.showLess') : label ?? t('common.viewMore')}
      variant="secondary"
      fullWidth={false}
      onPress={onPress}
      style={styles.button}
    />
  );
}

const styles = {
  button: { alignSelf: 'center', minWidth: 180 } as const,
};
