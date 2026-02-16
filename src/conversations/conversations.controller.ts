import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { StartConversationDto, SendMessageDto } from './dto/conversation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  // Specific routes must come before parameterized routes
  @Public()
  @Post('start')
  async start(
    @Body() startDto: StartConversationDto,
    @Headers('x-widget-token') widgetToken?: string,
    @CurrentUser() user?: any, // Opcional: se autenticado, usa userId e companyId
  ) {
    // Aceita widgetToken no header ou no body
    const token = widgetToken || startDto.widgetToken;
    
    if (!token && !startDto.agentId) {
      throw new BadRequestException('widgetToken or agentId is required');
    }

    return this.conversationsService.start(
      startDto.agentId,
      startDto.externalId,
      token,
      user?.userId,
      user?.companyId,
    );
  }

  @Public()
  @Post('send-message')
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    return this.conversationsService.sendMessage(
      sendMessageDto.conversationId,
      sendMessageDto.message,
    );
  }

  @Get('agent/:agentId')
  @UseGuards(JwtAuthGuard)
  async findByAgent(@Param('agentId', ParseIntPipe) agentId: number, @CurrentUser() user: any) {
    return this.conversationsService.findByAgent(agentId, user.userId, user.companyId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.conversationsService.findOne(id, user.userId, user.companyId);
  }
}

