export type LinkableCard = {
  id: number;
  kind: "paper" | "author" | "journal";
  title: string;
  detail: string;
};

export const cardHref = (id: number) => `#card-${id}`;

export function linkedCardId(href: string) {
  const id = /^#card-(\d+)$/.exec(href)?.[1];
  return id === undefined ? null : Number(id);
}

export function safeLink(href: string) {
  return linkedCardId(href) !== null || /^(?:https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(href);
}

export function inlineCardIds(html: string) {
  if (!html.includes("#card-")) return [];
  return Array.from(new Set(Array.from(
    safeRichHtml(html).matchAll(/<a href="#card-(\d+)">/g),
    match => Number(match[1]),
  )));
}

export function remapInlineLinks(html: string, ids: Map<number, number>) {
  return html.replace(/(<a\b[^>]*?\bhref=)(["'])#card-(\d+)\2/gi,
    (_, prefix: string, quote: string, id: string) =>
      `${prefix}${quote}${cardHref(ids.get(Number(id)) ?? Number(id))}${quote}`);
}

const tags = new Set([
  "p", "div", "br", "b", "strong", "i", "em", "u", "s", "strike", "del",
  "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
  "code", "pre", "hr", "span", "a",
]);

// Rebuild only supported elements and attributes, including for server previews.
// Pasted and imported HTML can contain arbitrary markup.
export function safeRichHtml(value: string, term = "") {
  const clean = value.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|xml)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const hasMarkup = /<\/?[a-z][^>]*>/i.test(clean);
  const needle = term.trim();
  const matcher = needle && new RegExp(needle.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&"), "gi");
  return clean.split(/(<(?:"[^"]*"|'[^']*'|[^'">])*?>)/g).map((part, index) => {
    if (!(index % 2)) {
      const text = part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const highlighted = matcher ? text.split(/(&[\w#]+;)/g).map((piece, i) =>
        i % 2 ? piece : piece.replace(matcher, '<mark class="search-highlight">$&</mark>')).join("") : text;
      return hasMarkup ? highlighted : highlighted.replace(/\r\n?|\n/g, "<br>").replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
    }
    const tagMatch = /^<(\/?)([a-z][\w-]*)(?=\s|\/?>)([\s\S]*)>$/i.exec(part);
    if (!tagMatch) return part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const [, closing, rawTag, attrs] = tagMatch;
    const tag = rawTag.toLowerCase();
    if (!tags.has(tag)) return "";
    if (closing) return `</${tag}>`;
    if (tag === "span") return /\bclass\s*=\s*["']double-underline["']/i.test(attrs) ? '<span class="double-underline">' : "<span>";
    if (tag === "a") {
      const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2] || "";
      if (!safeLink(href)) return "<a>";
      const attribute = href.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return linkedCardId(href) === null
        ? `<a href="${attribute}" target="_blank" rel="noopener noreferrer">`
        : `<a href="${attribute}">`;
    }
    if (tag === "ol") {
      const start = /\bstart\s*=\s*["']?(\d+)/i.exec(attrs)?.[1];
      if (start) return `<ol start="${start}">`;
    }
    return `<${tag}>`;
  }).join("");
}
