import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MESSAGE_MAX_LENGTH,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from '@nexo/shared';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'ana.souza@nexo.com.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @ApiProperty({ example: 'qualquer-senha' })
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(200)
  password: string;
}

export class UpdateDraftRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ enum: TICKET_CATEGORIES })
  @IsOptional()
  @IsIn(TICKET_CATEGORIES)
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TICKET_PRIORITIES })
  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriority;
}

export class MessageReplyDto {
  @ApiProperty({ description: 'Mensagem do agent que trazia as opções' })
  @IsString()
  messageId: string;

  @ApiProperty({ enum: ['QUICK_REPLY', 'TICKET_PICKER'] })
  @IsIn(['QUICK_REPLY', 'TICKET_PICKER'])
  kind: 'QUICK_REPLY' | 'TICKET_PICKER';

  @ApiProperty({ description: 'Opção escolhida ou id do chamado' })
  @IsString()
  @MaxLength(200)
  value: string;
}

export class SendMessageRequestDto {
  @ApiProperty({ example: 'Meu notebook não conecta na VPN desde ontem.' })
  @IsString()
  @IsNotEmpty({ message: 'Escreva uma mensagem.' })
  @MaxLength(MESSAGE_MAX_LENGTH, {
    message: `A mensagem deve ter até ${MESSAGE_MAX_LENGTH} caracteres.`,
  })
  text: string;

  @ApiPropertyOptional({ type: MessageReplyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageReplyDto)
  reply?: MessageReplyDto;
}

export class AnalystMessageRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Escreva uma mensagem.' })
  @MaxLength(MESSAGE_MAX_LENGTH)
  text: string;
}

export class CloseConversationRequestDto {
  @ApiPropertyOptional({
    description: 'Resolve também o chamado em foco no sistema de chamados',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  resolveTicket?: boolean;

  @ApiPropertyOptional({ description: 'Solução aplicada; vai para o histórico do chamado' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;
}

export class ConsoleListQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'waiting', 'agent', 'mine'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'waiting', 'agent', 'mine'])
  filter: 'all' | 'waiting' | 'agent' | 'mine' = 'all';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
