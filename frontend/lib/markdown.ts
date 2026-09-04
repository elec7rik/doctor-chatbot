export const BRANDS = ["my-peptides.co.uk", "mypeptideslabs.com", "thenad.co.uk", "imnatura.co.uk"] as const;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  let out = esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(Strong|Moderate|Promising|Animal-only)\*/g, '<span class="tier">$1</span>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const d of BRANDS) {
    out = out.replace(
      new RegExp("(?<!//)\\b" + d.replace(/\./g, "\\.") + "\\b", "g"),
      '<a href="https://' + d + '" target="_blank" rel="noopener">' + d + "</a>",
    );
  }
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "";
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) {
      html += "</" + list + ">";
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,6}\s+(.*)/))) {
      closeList();
      html += "<h3>" + inline(m[1]!) + "</h3>";
    } else if ((m = line.match(/^[-*]\s+(.*)/))) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        html += "<ul>";
      }
      html += "<li>" + inline(m[1]!) + "</li>";
    } else if ((m = line.match(/^\d+[.)]\s+(.*)/))) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        html += "<ol>";
      }
      html += "<li>" + inline(m[1]!) + "</li>";
    } else {
      closeList();
      html += "<p>" + inline(line) + "</p>";
    }
  }
  closeList();
  return html;
}

export function stripDisclaimer(t: string): string {
  return t
    .replace(/\s*(?:\*\*\*|---)?\s*>?\s*The Nutty Professor is an AI character[\s\S]*?qualified clinician\.?\s*$/i, "")
    .trim();
}

export function stripGuideTokens(t: string): string {
  return t
    .replace(/\[\[guide:[a-z0-9-]*\]\]/gi, "")
    .replace(/\s*\[\[[^\]]*$/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractGuideSlugs(t: string): string[] {
  const seen: string[] = [];
  const re = /\[\[guide:([a-z0-9-]+)\]\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const s = m[1]!.toLowerCase();
    if (!seen.includes(s)) seen.push(s);
  }
  return seen;
}

export function toSpeechText(full: string): string {
  let t = stripDisclaimer(stripGuideTokens(full));
  t = t
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(Strong|Moderate|Promising|Animal-only)\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+[.)]\s+/gm, "");
  return t.replace(/\s+/g, " ").trim();
}
