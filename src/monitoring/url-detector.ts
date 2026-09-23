const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

export function detectExternalUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const unique = [...new Set(matches.map(url => url.replace(/[.,!?;:]+$/, "")))];

  return unique.filter(url => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return !(
        host === "t.me" ||
        host === "telegram.me" ||
        host === "telegram.dog" ||
        host.endsWith(".telegram.org")
      );
    } catch {
      return false;
    }
  });
}
