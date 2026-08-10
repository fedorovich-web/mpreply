export interface BraceExpansionOptions {
  max?: number;
  maxLength?: number;
}

declare function expand(
  pattern: string,
  options?: BraceExpansionOptions,
): string[];

export { expand };
export const EXPANSION_MAX: number;
export const EXPANSION_MAX_LENGTH: number;
export default expand;
