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

// FILL=1 weight 500, check_circle only: the selected state of the add toggle.
const FILLED = createIconSet(
  glyphMap,
  'MaterialSymbolsRounded_500_filled',
  require('../../../../assets/fonts/MaterialSymbolsRounded_500_filled.ttf'),
);

export type AppIconProps = {
  /** A Paper internal name or a Material Symbol name (see aliases.ts). */
  name: string;
  size?: number;
  color?: string;
  testID?: string;
  /** 700 is the checkbox mark's weight; 500 everywhere else. */
  weight?: 500 | 700;
  /** The filled form (FILL=1, weight 500); only `check_circle` has it. */
  filled?: boolean;
};

/** Renders a Material Symbol at the mockups' weight, resolving Paper's names through aliases. */
export const AppIcon = ({
  name,
  weight = 500,
  size,
  color,
  testID,
  filled = false,
}: AppIconProps) => {
  const IconSet = filled ? FILLED : weight === 700 ? BOLD : MEDIUM;
  return (
    <IconSet
      name={resolveSymbol(name)}
      size={size}
      color={color}
      testID={testID}
    />
  );
};
