import { FSMEngine } from "./engine";
import type { Agent, Conversation } from "@shared/types";
import {
  InitializingStateHandler,
  CollectingNameStateHandler,
  CollectingEmailStateHandler,
  CollectingPhoneStateHandler,
} from "./handlers/basic-handlers";
import {
  CreatingLeadStateHandler,
  AskingQuestionsStateHandler,
  CompletedStateHandler,
  ErrorStateHandler,
} from "./handlers/business-handlers";
import {
  ShowingCalendarStateHandler,
  ConfirmingAppointmentStateHandler,
} from "./handlers/calendar-handlers";
import { NegotiatingCalendarStateHandler } from "./handlers/intelligent-calendar-handler";
// Conversation helper interface - will be injected
export interface ConversationHelper {
  createConversation(data: {
    agentId: number;
    companyId: number;
    externalId?: string;
    currentState: string;
    context: any;
    status?: string;
  }): Promise<Conversation>;
  getConversationById(id: number, companyId: number): Promise<Conversation | null>;
  updateConversationContext(id: number, companyId: number, context: any): Promise<void>;
  updateConversationStatus(id: number, companyId: number, status: string): Promise<void>;
  addMessage(data: {
    conversationId: number;
    companyId: number;
    role: string;
    content: string;
    metadata?: any;
  }): Promise<any>;
}

/**
 * Main orchestrator that manages agent conversations
 */
export class AgentOrchestrator {
  private engine: FSMEngine;
  private conversationHelper: ConversationHelper;

  constructor(conversationHelper?: ConversationHelper) {
    this.engine = new FSMEngine();
    this.conversationHelper = conversationHelper!;
    this.registerAllHandlers();
  }

  setConversationHelper(helper: ConversationHelper) {
    this.conversationHelper = helper;
  }

  /**
   * Register all available state handlers
   */
  private registerAllHandlers(): void {
    this.engine.registerHandlers({
      INITIALIZING: new InitializingStateHandler(),
      COLLECTING_NAME: new CollectingNameStateHandler(),
      COLLECTING_EMAIL: new CollectingEmailStateHandler(),
      COLLECTING_PHONE: new CollectingPhoneStateHandler(),
      CREATING_LEAD: new CreatingLeadStateHandler(),
      ASKING_STRATEGIC_QUESTIONS: new AskingQuestionsStateHandler(),
      SHOWING_CALENDAR_OPTIONS: new ShowingCalendarStateHandler(),
      CONFIRMING_APPOINTMENT: new ConfirmingAppointmentStateHandler(),
      NEGOTIATING_CALENDAR: new NegotiatingCalendarStateHandler(),
      COMPLETED: new CompletedStateHandler(),
      ERROR: new ErrorStateHandler(),
    });
  }

  /**
   * Start a new conversation with an agent
   */
  async startConversation(agent: Agent, companyId: number, externalId?: string): Promise<Conversation> {
    const conversation = await this.conversationHelper.createConversation({
      agentId: agent.id,
      companyId: companyId,
      externalId,
      currentState: agent.fsmConfig.initialState,
      context: {
        currentState: agent.fsmConfig.initialState,
      },
      status: "active",
    });

    return conversation;
  }

  /**
   * Process a user message in a conversation
   */
  async processMessage(
    conversationId: number,
    agent: Agent,
    companyId: number,
    userMessage: string,
  ): Promise<{ response: string; conversation: Conversation }> {
    // Get the current conversation
    const conversation = await this.conversationHelper.getConversationById(conversationId, companyId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Check if conversation is still active
    if (conversation.status !== "active") {
      return {
        response: "Esta conversa já foi finalizada. Obrigado!",
        conversation,
      };
    }

    // Save user message
    await this.conversationHelper.addMessage({
      conversationId: conversation.id,
      companyId: conversation.companyId,
      role: "user",
      content: userMessage,
      metadata: {
        stateAtTime: conversation.currentState,
      },
    });

    try {
      // Process through FSM
      const result = await this.engine.processMessage(agent, conversation, userMessage);

      // Update conversation context
      await this.conversationHelper.updateConversationContext(conversation.id, companyId, result.newContext);

      // Check if we reached a terminal state
      const newState = result.newContext.currentState;
      if (newState === "COMPLETED" || newState === "ERROR") {
        await this.conversationHelper.updateConversationStatus(conversation.id, companyId, "completed");
      }

      // Save assistant response
      await this.conversationHelper.addMessage({
        conversationId: conversation.id,
        companyId: conversation.companyId,
        role: "assistant",
        content: result.response,
        metadata: {
          stateAtTime: newState,
          ...result.metadata,
        },
      });

      // Get updated conversation
      const updatedConversation = await this.conversationHelper.getConversationById(conversationId, companyId);

      return {
        response: result.response,
        conversation: updatedConversation!,
      };
    } catch (error) {
      console.error("[AgentOrchestrator] Error processing message:", error);

      // Mark conversation as error
      await this.conversationHelper.updateConversationStatus(conversation.id, companyId, "error");

      // Save error message
      const errorResponse = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.";
      await this.conversationHelper.addMessage({
        conversationId: conversation.id,
        companyId: conversation.companyId,
        role: "assistant",
        content: errorResponse,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      const updatedConversation = await this.conversationHelper.getConversationById(conversationId, companyId);

      return {
        response: errorResponse,
        conversation: updatedConversation!,
      };
    }
  }

  /**
   * Get the initial greeting for a new conversation
   */
  async getInitialGreeting(agent: Agent, conversation: Conversation): Promise<string> {
    const initialHandler = this.engine["handlers"].get(agent.fsmConfig.initialState);
    if (!initialHandler) {
      return "Olá! Como posso ajudá-lo?";
    }

    try {
      const result = await initialHandler.process(agent, conversation, "");

      // Update conversation with the new state
      await this.conversationHelper.updateConversationContext(conversation.id, conversation.companyId, result.newContext);

      // Save the greeting message
      await this.conversationHelper.addMessage({
        conversationId: conversation.id,
        companyId: conversation.companyId,
        role: "assistant",
        content: result.response,
        metadata: {
          stateAtTime: result.newContext.currentState,
        },
      });

      return result.response;
    } catch (error) {
      console.error("[AgentOrchestrator] Error getting initial greeting:", error);
      return "Olá! Como posso ajudá-lo?";
    }
  }
}

// Note: agentOrchestrator singleton removed - use dependency injection instead
