import {
  TICKET_CATEGORIES,
  TICKET_IMPACTS,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  type TicketCategory,
  type TicketImpact,
  type TicketPriority,
  type TicketType,
} from '@nexo/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import type { SupportGroup, TicketUpdateAuthor } from '@/domain/entities/ticket.entity';

const WRITE_AUTHORS = ['REQUESTER', 'AGENT', 'ANALYST'] as const;
const SUPPORT_GROUPS = ['N1', 'N2'] as const;

export class ListTicketsQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'recent', 'all'], default: 'recent' })
  @IsOptional()
  @IsIn(['open', 'recent', 'all'])
  scope: 'open' | 'recent' | 'all' = 'recent';
}

export class CreateTicketRequestDto {
  @ApiProperty({ enum: TICKET_TYPES })
  @IsIn(TICKET_TYPES)
  type: TicketType;

  @ApiProperty({ example: 'VPN não conecta no notebook — erro 809' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;

  @ApiProperty({ enum: TICKET_CATEGORIES })
  @IsIn(TICKET_CATEGORIES)
  category: TicketCategory;

  @ApiProperty({ enum: TICKET_PRIORITIES })
  @IsIn(TICKET_PRIORITIES)
  priority: TicketPriority;

  @ApiProperty({ enum: TICKET_IMPACTS })
  @IsIn(TICKET_IMPACTS)
  impact: TicketImpact;

  @ApiPropertyOptional({ enum: WRITE_AUTHORS, default: 'AGENT' })
  @IsOptional()
  @IsIn(WRITE_AUTHORS)
  author: TicketUpdateAuthor = 'AGENT';
}

export class AddTicketUpdateRequestDto {
  @ApiProperty({ example: 'Reiniciei o notebook e o erro continua.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({ enum: WRITE_AUTHORS, default: 'AGENT' })
  @IsOptional()
  @IsIn(WRITE_AUTHORS)
  author: TicketUpdateAuthor = 'AGENT';

  @ApiPropertyOptional({ example: 'Rafael Lima' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorName?: string;
}

export class ReopenTicketRequestDto {
  @ApiProperty({ example: 'A senha bloqueou de novo depois do desbloqueio.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @ApiPropertyOptional({ enum: WRITE_AUTHORS, default: 'AGENT' })
  @IsOptional()
  @IsIn(WRITE_AUTHORS)
  author: TicketUpdateAuthor = 'AGENT';
}

export class TransferTicketRequestDto {
  @ApiProperty({ enum: SUPPORT_GROUPS })
  @IsIn(SUPPORT_GROUPS)
  group: SupportGroup;

  @ApiProperty({ example: 'Funcionária relata lentidão há 6 dias; prazo vencido.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  summary: string;
}
