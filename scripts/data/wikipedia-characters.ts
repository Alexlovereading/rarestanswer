/**
 * Characters named on the English Wikipedia list page, parsed from MediaWiki
 * wikitext. Names come from that page's cast tables, character headings, and
 * "Actor as Character" credits. Nothing is added from outside the page.
 */
export interface ListedCharacter {
  name: string;
  aliases: string[];
  /** English Wikipedia title, when the page links the character to an article. */
  wiki?: string;
}

interface LinkHit {
  target: string;
  display: string;
}

const CAST_HEADINGS = new Set(['Main cast', 'Also starring', 'Recurring cast']);
const CHARACTER_PARENTS = new Set(['Main characters', 'Creatures of the Abyss']);
const CREDIT_PARENTS = new Set(['Recurring characters', 'Guest characters']);

const REQUIRED_HEADINGS = ['Main cast', 'Main characters', 'Recurring characters', 'Guest characters', 'Creatures of the Abyss'];

export function assertStrangerThingsSections(lines: readonly string[]): void {
  const present = new Set(lines.map(plainHeading));
  const missing = REQUIRED_HEADINGS.filter((heading) => !present.has(heading));
  if (missing.length > 0) {
    throw new Error(`List of Stranger Things characters is missing sections: ${missing.join(', ')}`);
  }
}

export function plainHeading(line: string): string {
  return line
    .replace(/<[^>]+>/g, '')
    .replace(/''+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripComments(value: string): string {
  return value.replace(/<!--[\s\S]*?-->/g, '');
}

function stripRefs(value: string): string {
  return value.replace(/<ref\b[^>]*\/>/gi, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '');
}

function expandAnchors(value: string): string {
  return value.replace(/\{\{(?:vanchor|anchor)\|([^{}|]+)(?:\|[^{}]*)?\}\}/gi, '$1');
}

function stripTemplates(value: string): string {
  let current = value;
  for (let pass = 0; pass < 8; pass += 1) {
    const next = current.replace(/\{\{[^{}]*\}\}/g, '');
    if (next === current) break;
    current = next;
  }
  return current;
}

function splitLink(inner: string): { target: string; hash: string; display: string } {
  const pipe = inner.indexOf('|');
  const left = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
  const display = (pipe >= 0 ? inner.slice(pipe + 1) : left).trim();
  const hashAt = left.indexOf('#');
  const target = (hashAt >= 0 ? left.slice(0, hashAt) : left).replace(/_/g, ' ').trim();
  const hash = hashAt >= 0 ? left.slice(hashAt) : '';
  return { target, hash, display };
}

function linkHits(value: string): LinkHit[] {
  const hits: LinkHit[] = [];
  for (const match of value.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const link = splitLink(match[1] ?? '');
    hits.push({ target: link.hash ? '' : link.target, display: link.display });
  }
  return hits;
}

function articleTitle(target: string): string | undefined {
  const cleaned = target.replace(/_/g, ' ').trim();
  if (!cleaned || cleaned.startsWith('#')) return undefined;
  if (/^list of /i.test(cleaned)) return undefined;
  const prefix = cleaned.split(':')[0]?.toLowerCase() ?? '';
  if (['file', 'image', 'category', 'wikipedia', 'template', 'talk', 'user', 'help', 'portal', 'draft', 'module', 'media', 'special'].includes(prefix)) {
    return undefined;
  }
  return cleaned;
}

function replaceLinks(value: string): string {
  return value.replace(/\[\[([^\]]+)\]\]/g, (_full, inner: string) => splitLink(inner).display);
}

function cleanMarkup(raw: string): string {
  const value = stripTemplates(replaceLinks(expandAnchors(stripRefs(stripComments(raw)))));
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cutAtComma(value: string): string {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '(') depth += 1;
    else if (char === ')' && depth > 0) depth -= 1;
    else if ((char === ',' || char === ';') && depth === 0) return value.slice(0, index).trim();
  }
  return value.trim();
}

function isGeneric(name: string): boolean {
  return /^(?:a|an|the|his|her|their)\b/i.test(name);
}

function rejectName(name: string): boolean {
  if (name.length < 2 || name.length > 80) return true;
  if (!/[A-Za-z]/.test(name)) return true;
  if (isGeneric(name)) return true;
  if (/^(?:himself|herself|themselves|narrator|various|others|n\/a)$/i.test(name)) return true;
  if (/['’]s\b/.test(name) || /\bas\b/i.test(name) || name.includes('[[')) return true;
  if (/introduced in season/i.test(name)) return true;
  return false;
}

function quotedBits(value: string): string[] {
  return [...value.matchAll(/"([^"]{2,40})"/g)]
    .map((match) => (match[1] ?? '').replace(/[,.]+$/g, '').trim())
    .filter((bit) => bit.length >= 2 && bit.length <= 40 && !isGeneric(bit));
}

interface ParsedName {
  name: string;
  aliases: string[];
  wiki?: string;
  preferred: boolean;
}

function namesFromPhrase(raw: string, wiki: string | undefined, preferred: boolean, allowLower = false): ParsedName | null {
  const links = linkHits(raw).filter((hit) => articleTitle(hit.target) || hit.display);
  const firstArticle = links.map((hit) => articleTitle(hit.target)).find((title): title is string => Boolean(title));
  const marked = cleanMarkup(raw);
  const clipped = cutAtComma(marked).replace(/\.+$/g, '').trim();
  if (!clipped) return null;
  const aliases: string[] = [];
  for (const bit of quotedBits(clipped)) aliases.push(bit);
  let working = clipped.replace(/"([^"]+)"/g, ' ').replace(/\s+/g, ' ').trim();
  for (const match of working.matchAll(/\(\s*([^)]+?)\s*\)/g)) {
    const inner = (match[1] ?? '').replace(/^["']|["']$/g, '').trim();
    const innerKey = inner.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
    if (inner && !/^(?:born|nee|ne)\b/.test(innerKey) && !isGeneric(inner)) aliases.push(inner);
  }
  working = working.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = working.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  const name = parts[0] ?? '';
  for (const part of parts.slice(1)) aliases.push(part);
  if (parts.length > 1) aliases.push(parts.join(' / '));
  if (rejectName(name)) return null;
  if (!allowLower && !/^[A-Z]/.test(name) && !/^Dr\b/.test(name)) return null;
  if (/[|=]/.test(name)) return null;
  const unique = dedupeAliases(name, aliases);
  return { name, aliases: unique, wiki: wiki ?? firstArticle, preferred };
}

function dedupeAliases(name: string, aliases: string[]): string[] {
  const seen = new Set<string>([norm(name)]);
  const kept: string[] = [];
  for (const alias of aliases) {
    const cleaned = alias.replace(/\s+/g, ' ').trim();
    const key = norm(cleaned);
    if (!key || seen.has(key) || rejectName(cleaned) || cleaned.length > 80) continue;
    seen.add(key);
    kept.push(cleaned);
  }
  return kept;
}

function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function splitCreatureHeading(heading: string): string[] {
  if (!heading.includes(',')) return [heading];
  return heading
    .split(',')
    .map((part) => part.trim().replace(/^and\s+/i, '').trim())
    .filter((part) => part && !rejectName(part));
}

function nicknameQuotes(plain: string): string[] {
  const aliases: string[] = [];
  for (const match of plain.matchAll(/"([^"]{2,40})"/g)) {
    const start = match.index ?? 0;
    const before = plain.slice(Math.max(0, start - 90), start);
    if (!/nicknamed|referred to as|known as/i.test(before)) continue;
    const nick = (match[1] ?? '').replace(/[,.]+$/g, '').trim();
    if (nick && !isGeneric(nick) && nick.length <= 40) aliases.push(nick);
  }
  return aliases;
}

function proseAliases(name: string, body: string): string[] {
  const plain = cleanMarkup(body);
  const aliases = nicknameQuotes(plain);
  const surname = name.split(' ').at(-1) ?? '';
  const doctorFull = `Dr. ${name}`;
  if (plain.includes(doctorFull)) {
    aliases.push(doctorFull);
    if (surname.length >= 3 && surname !== name) aliases.push(`Dr. ${surname}`);
  }
  if (surname.length >= 3 && new RegExp(`\\bDr\\.\\s+${escapeRegExp(surname)}\\b`).test(plain)) {
    aliases.push(`Dr. ${surname}`);
  }
  return aliases;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mainArticle(body: string): string | undefined {
  const match = body.match(/\{\{Main\|([^|}]+)/i);
  return match?.[1] ? articleTitle(match[1].trim()) : undefined;
}

interface SectionChunk {
  heading: string;
  level: number;
  body: string;
}

function chunksOf(wikitext: string): SectionChunk[] {
  const lines = wikitext.split('\n');
  const chunks: SectionChunk[] = [];
  let current: SectionChunk | null = null;
  const body: string[] = [];
  const flush = (): void => {
    if (!current) return;
    current.body = body.join('\n');
    chunks.push(current);
    body.length = 0;
  };
  for (const line of lines) {
    const match = /^(=+)\s*(.*?)\s*\1\s*$/.exec(line);
    if (match?.[1] && match[2]) {
      flush();
      current = { heading: plainHeading(match[2]), level: match[1].length, body: '' };
      continue;
    }
    if (current) body.push(line);
  }
  flush();
  return chunks;
}

function parentsOf(chunks: SectionChunk[]): string[][] {
  const stack: { heading: string; level: number }[] = [];
  return chunks.map((chunk) => {
    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= chunk.level) stack.pop();
    const parents = stack.map((item) => item.heading);
    stack.push({ heading: chunk.heading, level: chunk.level });
    return parents;
  });
}

function tableCharacters(body: string): ParsedName[] {
  const found: ParsedName[] = [];
  for (const row of body.split('\n|-')) {
    const cell = row.match(/!\s*scope="row"[^|\n]*\|([^\n]*)/);
    if (!cell?.[1]) continue;
    const parsed = namesFromPhrase(stripComments(stripRefs(cell[1])), undefined, false);
    if (parsed) found.push(parsed);
  }
  return found;
}

function creditCharacters(body: string): ParsedName[] {
  const found: ParsedName[] = [];
  for (const line of body.split('\n')) {
    if (!line.startsWith('*')) continue;
    const cleaned = stripComments(stripRefs(line));
    const asMatches = [...cleaned.matchAll(/\sas\s/gi)];
    if (asMatches.length === 0) continue;
    const indexes = [asMatches[0]?.index ?? 0];
    for (let matchIndex = 1; matchIndex < asMatches.length; matchIndex += 1) {
      const start = asMatches[matchIndex]?.index ?? 0;
      const before = cleaned.slice(Math.max(0, start - 80), start);
      if (/\sand\s+\[\[[^\]]+\]\]\s*$/i.test(before)) indexes.push(start);
    }
    for (const start of indexes) {
      const phrase = cleaned.slice(start).replace(/^\s*as\s+/i, '').replace(/\s+and\s+\[\[[^\]]+\]\][\s\S]*$/i, '');
      const parsed = namesFromPhrase(phrase, undefined, false);
      if (parsed) found.push(parsed);
    }
  }
  return found;
}

function mergeAll(entries: ParsedName[]): ListedCharacter[] {
  const byKey = new Map<string, ParsedName>();
  const aliasOwner = new Map<string, string>();
  const absorb = (into: ParsedName, extra: ParsedName): void => {
    if (extra.preferred && !into.preferred) {
      into.aliases.push(into.name);
      into.name = extra.name;
      into.preferred = true;
    } else if (norm(extra.name) !== norm(into.name)) {
      into.aliases.push(extra.name);
    }
    into.aliases.push(...extra.aliases);
    into.wiki = into.wiki ?? extra.wiki;
    into.aliases = dedupeAliases(into.name, into.aliases);
  };
  for (const entry of entries) {
    const nameKey = norm(entry.name);
    let ownerKey = byKey.has(nameKey) ? nameKey : aliasOwner.get(nameKey);
    if (!ownerKey) {
      for (const alias of entry.aliases) {
        const aliasKey = norm(alias);
        if (byKey.has(aliasKey)) {
          ownerKey = aliasKey;
          break;
        }
        const via = aliasOwner.get(aliasKey);
        if (via && byKey.has(via)) {
          ownerKey = via;
          break;
        }
      }
    }
    if (!ownerKey && entry.wiki) {
      for (const [key, existing] of byKey) {
        if (existing.wiki && existing.wiki === entry.wiki) {
          ownerKey = key;
          break;
        }
      }
    }
    if (!ownerKey) {
      byKey.set(nameKey, { ...entry, aliases: [...entry.aliases] });
      for (const alias of entry.aliases) aliasOwner.set(norm(alias), nameKey);
      continue;
    }
    const owner = byKey.get(ownerKey);
    if (!owner) continue;
    absorb(owner, entry);
    for (const alias of owner.aliases) aliasOwner.set(norm(alias), ownerKey);
    aliasOwner.set(norm(owner.name), ownerKey);
  }
  return [...byKey.values()].map((entry) => {
    const character: ListedCharacter = { name: entry.name, aliases: dedupeAliases(entry.name, entry.aliases) };
    if (entry.wiki) character.wiki = entry.wiki;
    return character;
  });
}

/** Cast tables, character headings, and recurring/guest credits on the list page. */
export function parseStrangerThingsWikitext(wikitext: string): ListedCharacter[] {
  const chunks = chunksOf(wikitext);
  assertStrangerThingsSections(chunks.map((chunk) => chunk.heading));
  const parents = parentsOf(chunks);
  const parsed: ParsedName[] = [];
  chunks.forEach((chunk, index) => {
    const chain = parents[index] ?? [];
    if (CAST_HEADINGS.has(chunk.heading)) {
      parsed.push(...tableCharacters(chunk.body));
      return;
    }
    if (CHARACTER_PARENTS.has(chain[0] ?? '') && chunk.level > 1) {
      const wiki = mainArticle(chunk.body);
      const pieces = chunk.heading.includes(',') ? splitCreatureHeading(chunk.heading) : [chunk.heading];
      for (const piece of pieces) {
        const item = namesFromPhrase(piece, wiki, true, true);
        if (!item) continue;
        if (pieces.length === 1) item.aliases.push(...proseAliases(item.name, chunk.body));
        if (/s$/i.test(piece)) {
          const singular = piece.replace(/s$/i, '');
          const singularWord = new RegExp(`\\b${escapeRegExp(singular)}\\b`, 'i');
          if (singular.length >= 4 && singularWord.test(cleanMarkup(chunk.body))) {
            item.aliases.push(singular.charAt(0).toUpperCase() + singular.slice(1));
          }
        }
        const quoted = quotedBits(cleanMarkup(chunk.body)).filter((bit) => {
          const bitKey = norm(bit);
          const pieceKey = norm(piece);
          return bitKey !== pieceKey && (pieceKey.startsWith(bitKey) || bitKey.startsWith(pieceKey));
        });
        item.aliases.push(...quoted);
        item.aliases = dedupeAliases(item.name, item.aliases);
        parsed.push(item);
      }
      return;
    }
    if (CREDIT_PARENTS.has(chain[0] ?? '') || CREDIT_PARENTS.has(chunk.heading)) {
      parsed.push(...creditCharacters(chunk.body));
    }
  });
  const merged = mergeAll(parsed);
  if (merged.length < 15) {
    throw new Error(`parsed only ${merged.length} Stranger Things characters`);
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}
