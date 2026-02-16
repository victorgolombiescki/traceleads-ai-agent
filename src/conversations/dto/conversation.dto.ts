import { IsNumber, IsString, IsOptional } from 'class-validator';

export class StartConversationDto {
  @IsNumber()
  @IsOptional()
  agentId?: number;

  @IsString()
  @IsOptional()
  widgetToken?: string;

  @IsString()
  @IsOptional()
  externalId?: string;
}

export class SendMessageDto {
  @IsNumber()
  conversationId: number;

  @IsString()
  message: string;
}


