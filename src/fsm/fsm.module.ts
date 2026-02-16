import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FsmService } from './fsm.service';
import { ConversationHelperService } from './conversation-helper.service';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';

// Export FSM engine and handlers for use in services
export * from './engine';
export * from './orchestrator';
export * from './handlers/basic-handlers';
export * from './handlers/business-handlers';
export * from './handlers/calendar-handlers';
export * from './handlers/intelligent-calendar-handler';
export * from './llm-utils';
export * from './llm-utils-v2';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  providers: [FsmService, ConversationHelperService],
  exports: [FsmService, ConversationHelperService],
})
export class FsmModule {}

