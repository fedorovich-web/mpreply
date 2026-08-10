export interface BraceExpansionOptions {
  max?: number;
  maxLength?: number;
}

declare function expand(
  value: string,
  options?: BraceExpansionOptions,
): string[];

export { expand };
export default expand;
export const EXPANSION_MAX: number;
export const EXPANSION_MAX_LENGTH: number;
