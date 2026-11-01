/** A piece of a task's description: plain text, or a web link to open with `href`. */
export interface DescriptionPart {
  text: string;
  href?: string;
}

const WEB_ADDRESS = /(?<![\w.@/])(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[.,!?:;'"]+$/;

/**
 * Splits a description into text and the web addresses in it, so a link pasted into a task (such as a gift to
 * buy) can be tapped. Only http(s) addresses become links, never other schemes such as `javascript:`.
 */
export function descriptionParts(description: string): DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let textStart = 0;
  for (const match of description.matchAll(WEB_ADDRESS)) {
    const address = withoutTrailingPunctuation(match[0]);
    if (match.index > textStart) parts.push({ text: description.slice(textStart, match.index) });
    parts.push({ text: address, href: /^www\./i.test(address) ? `https://${address}` : address });
    textStart = match.index + address.length;
  }
  if (textStart < description.length) parts.push({ text: description.slice(textStart) });
  return parts;
}

/** The address without the punctuation, or closing bracket, that ends the sentence around it. */
function withoutTrailingPunctuation(address: string): string {
  const trimmed = address.replace(TRAILING_PUNCTUATION, '');
  const opens = trimmed.split('(').length - 1;
  const closes = trimmed.split(')').length - 1;
  return trimmed.endsWith(')') && closes > opens
    ? withoutTrailingPunctuation(trimmed.slice(0, -1))
    : trimmed;
}
