import { Injectable } from '@nestjs/common';

import type { HelpArticleRepository } from '@/application/ports/repositories.port';
import type { HelpArticleRecord } from '@/domain/entities/message';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 60_000;

/** Poucos artigos e raramente alterados: cache em memória evita uma query por mensagem. */
@Injectable()
export class PrismaHelpArticleRepository implements HelpArticleRepository {
  private cache: { articles: HelpArticleRecord[]; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<HelpArticleRecord[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.articles;

    const articles = await this.prisma.helpArticle.findMany({ orderBy: { id: 'asc' } });
    this.cache = { articles, expiresAt: Date.now() + CACHE_TTL_MS };

    return articles;
  }
}
