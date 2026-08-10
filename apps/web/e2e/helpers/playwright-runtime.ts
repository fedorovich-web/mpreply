export const DEFAULT_PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3120";

export function resolvePlaywrightBaseURL(): string {
  const configured =
    process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_PLAYWRIGHT_BASE_URL;
  return new URL(configured).origin;
}
