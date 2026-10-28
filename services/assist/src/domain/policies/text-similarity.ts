const STOPWORDS = new Set(
  'a o e de da do das dos em no na nos nas um uma uns umas para por com sem que se ao aos à às meu minha meus minhas seu sua seus suas é está estou não mais muito pra pro como ou mas desde já foi ser ter tem tá isso esse essa este esta quando onde qual quero preciso consigo'.split(
    ' ',
  ),
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ');
}

/** Tokens com radical simplificado (corta plural e terminações comuns). */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s-]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map((token) => (/^\d+$/.test(token) ? token : token.replace(/(oes|aes|s)$/, '').slice(0, 7)));
}

/** Sobreposição de Jaccard entre os conjuntos de tokens (0 a 1). */
export function jaccard(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;

  return shared / (left.size + right.size - shared);
}
