import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';

export type ButtonProps = ComponentProps<typeof PaperButton>;

/**
 * Paper's button, grown from 40 to the 48 dp a finger needs (FR-034). Text buttons look the
 * same; outlined and contained ones are 8 dp taller.
 */
export const Button = ({ contentStyle, ...props }: ButtonProps) => (
  <PaperButton {...props} contentStyle={[styles.target, contentStyle]} />
);

const styles = StyleSheet.create({
  target: { minHeight: 48 },
});
