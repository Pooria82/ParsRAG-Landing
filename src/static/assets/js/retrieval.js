// A small, honest stand-in for ParsRAG's retrieval, used by the in-browser demo:
// Persian/English normalization, BM25 keyword scoring, @{file} scoping per clause,
// and the "distinctive terms" check that decides whether evidence is sufficient.

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Follows ParsRAG 1.0's normalize_persian and BM25 tokenizer: Arabic Yeh/Kaf to Persian,
 * tatweel and diacritics removed (the ezafe hamza is kept), ZWNJ read as a space, and
 * Persian/Arabic-Indic digits read as ASCII.
 */
export function normalize(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[يىے]/g, 'ی')
    .replace(/[كڪ]/g, 'ک')
    .replace(/[\u0640\u200b\ufeff]/g, '')
    .replace(/[\u064B-\u0653\u0655\u0656\u0670]/g, '')
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/\u200c/g, ' ')
    .replace(/(\d)[٫,](\d)/g, '$1.$2');
}

const stem = (t) => {
  if (/^[a-z]+$/.test(t)) {
    if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
    if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
    return t;
  }
  return t.replace(/(های|ها|ترین|تر)$/u, '') || t;
};

export function tokenize(text, stop) {
  return normalize(text)
    .split(/[^\p{L}\p{N}.]+/u)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length >= 2 && !stop.has(t))
    .map(stem);
}

export function createIndex(passages, stopwords) {
  const stop = new Set(stopwords.map((w) => normalize(w)));
  const docs = passages.map((p) => {
    const terms = tokenize(p.text, stop);
    const tf = new Map();
    terms.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    return { p, tf, len: terms.length };
  });
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  const df = new Map();
  docs.forEach((d) => d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const idf = (t) => Math.log(1 + (docs.length - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));

  /** BM25 (k1 = 1.2, b = 0.75) over the passages, optionally limited to one document. */
  function search(query, docId) {
    const q = [...new Set(tokenize(query, stop))];
    const results = docs
      .filter((d) => !docId || d.p.doc === docId)
      .map((d) => {
        let score = 0;
        const matched = [];
        for (const t of q) {
          const f = d.tf.get(t);
          if (!f) continue;
          matched.push(t);
          score += idf(t) * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.len / avgLen))));
        }
        return { passage: d.p, score, matched, coverage: q.length ? matched.length / q.length : 0 };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    return { terms: q, results };
  }
  return { search };
}

/** Splits "@{a.pdf} question one @{b.docx} question two" into clauses scoped to files. */
export function parseMentions(text, docs) {
  const re = /@\{((?:\\.|[^}])+)\}/g;
  const clauses = [];
  let last = 0;
  let scope = null;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index).trim();
    if (before) clauses.push({ text: before, doc: scope });
    const name = m[1].replace(/\\([{}])/g, '$1');
    scope = docs.find((d) => d.name === name)?.id || null;
    last = re.lastIndex;
  }
  const rest = text.slice(last).trim();
  if (rest) clauses.push({ text: rest, doc: scope });
  return clauses.length ? clauses : [{ text: text.trim(), doc: null }];
}

/** Evidence is sufficient when the best passage covers enough of the question's distinctive terms. */
export const hasEvidence = (hit) => Boolean(hit) && hit.score >= 1.1 && hit.coverage >= 0.6;
