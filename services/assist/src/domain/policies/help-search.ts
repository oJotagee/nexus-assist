import type { HelpArticleRecord } from '../entities/message';
import { tokenize } from './text-similarity';

export type HelpSearchHit = { article: HelpArticleRecord; score: number };

const TITLE_WEIGHT = 3;
const TAG_WEIGHT = 2;
const MIN_SCORE = 2;

/**
 * Busca por palavras-chave com pesos (título > tags > corpo). Com 8 artigos, isso é mais
 * barato e previsível que embeddings; o README discute quando trocar por busca semântica.
 */
export function searchHelpArticles(
  articles: HelpArticleRecord[],
  query: string,
  limit = 3,
): HelpSearchHit[] {
  const terms = new Set(tokenize(query));
  if (terms.size === 0) return [];

  return articles
    .map((article) => {
      const title = new Set(tokenize(article.title));
      const tags = new Set(article.tags.flatMap(tokenize));
      const body = new Set(tokenize(article.body));

      let score = 0;
      for (const term of terms) {
        if (title.has(term)) score += TITLE_WEIGHT;
        if (tags.has(term)) score += TAG_WEIGHT;
        if (body.has(term)) score += 1;
      }

      return { article, score };
    })
    .filter((hit) => hit.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
