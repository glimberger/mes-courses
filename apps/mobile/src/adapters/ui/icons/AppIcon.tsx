import { createIconSet } from '@expo/vector-icons';

import glyphs from './symbols-glyphs.json';
import { resolveSymbol } from './aliases';

const glyphMap: Record<string, number> = glyphs;

// Static instances of Material Symbols Rounded, bundled as expo-font assets (ADR-0012).
const MEDIUM = createIconSet(
  glyphMap,
  'MaterialSymbolsRounded_500',
  require('../../../../assets/fonts/MaterialSymbolsRounded_500.ttf'),
);
const BOLD = createIconSet(
  glyphMap,
  'MaterialSymbolsRounded_700',
  require('../../../../assets/fonts/MaterialSymbolsRounded_700.ttf'),
);

export type AppIconProps = {
  /** A Paper internal name or a Material Symbol name (see aliases.ts). */
  name: string;
  size?: number;
  color?: string;
  testID?: string;
  /** 700 is the checkbox mark's weight; 500 everywhere else. */
  weight?: 500 | 700;
};

/** Renders a Material Symbol at the mockups' weight, resolving Paper's names through aliases. */
export const AppIcon = ({
  name,
  weight = 500,
  size,
  color,
  testID,
}: AppIconProps) => {
  const Set = weight === 700 ? BOLD : MEDIUM;
  return (
    <Set name={resolveSymbol(name)} size={size} color={color} testID={testID} />
  );
};
