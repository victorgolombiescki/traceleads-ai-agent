import type { Agent, Conversation, ConversationContext } from "@shared/types";

/**
 * Result returned by a state handler after processing
 */
export interface StateHandlerResult {
  /** Response message to send to the user */
  response: string;
  /** Updated conversation context with new state and data */
  newContext: ConversationContext;
  /** Optional metadata about the processing */
  metadata?: Record<string, any>;
}

/**
 * Base interface that all state handlers must implement
 */
export interface IStateHandler {
  /**
   * Process a user message in the current state
   * @param agent The agent configuration
   * @param conversation The current conversation
   * @param userMessage The user's message
   * @returns Result with response and updated context
   */
  process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult>;
}

/**
 * Abstract base class for state handlers with common utilities
 */
export abstract class BaseStateHandler implements IStateHandler {
  abstract process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult>;

  /**
   * Helper to transition to a new state
   */
  protected transitionTo(
    currentContext: ConversationContext,
    newState: string,
    updates: Partial<ConversationContext> = {},
  ): ConversationContext {
    return {
      ...currentContext,
      ...updates,
      currentState: newState,
    };
  }

  /**
   * Helper to stay in the current state with updates
   */
  protected stayInState(
    currentContext: ConversationContext,
    updates: Partial<ConversationContext> = {},
  ): ConversationContext {
    return {
      ...currentContext,
      ...updates,
    };
  }
}

/**
 * FSM Engine - Orchestrates the conversation flow through states
 */
export class FSMEngine {
  private handlers: Map<string, IStateHandler> = new Map();

  /**
   * Register a state handler
   */
  registerHandler(stateName: string, handler: IStateHandler): void {
    this.handlers.set(stateName, handler);
  }

  /**
   * Register multiple handlers at once
   */
  registerHandlers(handlers: Record<string, IStateHandler>): void {
    Object.entries(handlers).forEach(([stateName, handler]) => {
      this.registerHandler(stateName, handler);
    });
  }

  /**
   * Process a message through the FSM
   */
  async processMessage(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    const currentState = conversation.currentState || agent.fsmConfig.initialState;
    const handler = this.handlers.get(currentState);

    if (!handler) {
      throw new Error(`No handler registered for state: ${currentState}`);
    }

    try {
      const result = await handler.process(agent, conversation, userMessage);
      return result;
    } catch (error) {
      console.error(`[FSM] Error in state ${currentState}:`, error);
      
      // Try to transition to error state if available
      const errorHandler = this.handlers.get('ERROR');
      if (errorHandler) {
        return await errorHandler.process(agent, conversation, userMessage);
      }

      // Fallback error response
      return {
        response: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        newContext: {
          ...conversation.context,
          lastError: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Get the current state definition from agent config
   */
  getStateDefinition(agent: Agent, stateName: string) {
    return agent.fsmConfig.states.find(s => s.id === stateName);
  }

  /**
   * Check if a state exists in the agent's FSM
   */
  hasState(agent: Agent, stateName: string): boolean {
    return agent.fsmConfig.states.some(s => s.id === stateName);
  }
}
