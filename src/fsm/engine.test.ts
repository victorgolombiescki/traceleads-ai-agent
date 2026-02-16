// Tests disabled - vitest not configured for NestJS
// import { describe, it, expect, beforeEach } from "vitest";
import { FSMEngine, BaseStateHandler, type StateHandlerResult } from "./engine";
import type { Agent, Conversation } from "../../shared/types";

// Mock state handler for testing
class TestStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    return {
      response: `Processed: ${userMessage}`,
      newContext: this.transitionTo(conversation.context, "NEXT_STATE", {
        testData: userMessage,
      }),
    };
  }
}

// Mock error handler
class ErrorStateHandler extends BaseStateHandler {
  async process(): Promise<StateHandlerResult> {
    throw new Error("Test error");
  }
}

describe("FSMEngine", () => {
  let engine: FSMEngine;
  let mockAgent: Agent;
  let mockConversation: Conversation;

  beforeEach(() => {
    engine = new FSMEngine();

    mockAgent = {
      id: 1,
      userId: 1,
      name: "Test Agent",
      description: "Test",
      isActive: true,
      fsmConfig: {
        initialState: "TEST_STATE",
        states: [
          { id: "TEST_STATE", name: "Test", type: "input", handlerClass: "TestStateHandler" },
          { id: "NEXT_STATE", name: "Next", type: "output", handlerClass: "TestStateHandler" },
        ],
        transitions: {
          TEST_STATE: "NEXT_STATE",
        },
      },
      behaviorConfig: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockConversation = {
      id: 1,
      agentId: 1,
      externalId: null,
      currentState: "TEST_STATE",
      context: {
        currentState: "TEST_STATE",
      },
      leadId: null,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
  });

  it("should register a handler", () => {
    const handler = new TestStateHandler();
    engine.registerHandler("TEST_STATE", handler);
    expect(engine["handlers"].has("TEST_STATE")).toBe(true);
  });

  it("should register multiple handlers", () => {
    const handlers = {
      STATE1: new TestStateHandler(),
      STATE2: new TestStateHandler(),
    };
    engine.registerHandlers(handlers);
    expect(engine["handlers"].size).toBe(2);
  });

  it("should process a message through registered handler", async () => {
    const handler = new TestStateHandler();
    engine.registerHandler("TEST_STATE", handler);

    const result = await engine.processMessage(mockAgent, mockConversation, "Hello");

    expect(result.response).toBe("Processed: Hello");
    expect(result.newContext.currentState).toBe("NEXT_STATE");
    expect(result.newContext.testData).toBe("Hello");
  });

  it("should throw error if no handler registered for state", async () => {
    await expect(
      engine.processMessage(mockAgent, mockConversation, "Hello"),
    ).rejects.toThrow("No handler registered for state: TEST_STATE");
  });

  it("should handle errors gracefully and return fallback response", async () => {
    const errorHandler = new ErrorStateHandler();
    engine.registerHandler("TEST_STATE", errorHandler);

    const result = await engine.processMessage(mockAgent, mockConversation, "Hello");

    expect(result.response).toContain("Desculpe, ocorreu um erro");
    expect(result.newContext.lastError).toBeDefined();
  });

  it("should get state definition from agent config", () => {
    const stateDef = engine.getStateDefinition(mockAgent, "TEST_STATE");
    expect(stateDef).toBeDefined();
    expect(stateDef?.id).toBe("TEST_STATE");
    expect(stateDef?.name).toBe("Test");
  });

  it("should check if state exists", () => {
    expect(engine.hasState(mockAgent, "TEST_STATE")).toBe(true);
    expect(engine.hasState(mockAgent, "NONEXISTENT")).toBe(false);
  });
});

describe("BaseStateHandler", () => {
  let handler: TestStateHandler;
  let mockContext: any;

  beforeEach(() => {
    handler = new TestStateHandler();
    mockContext = {
      currentState: "OLD_STATE",
      someData: "value",
    };
  });

  it("should transition to new state", () => {
    const newContext = handler["transitionTo"](mockContext, "NEW_STATE", {
      newData: "new value",
    });

    expect(newContext.currentState).toBe("NEW_STATE");
    expect(newContext.someData).toBe("value");
    expect(newContext.newData).toBe("new value");
  });

  it("should stay in current state with updates", () => {
    const newContext = handler["stayInState"](mockContext, {
      someData: "updated value",
    });

    expect(newContext.currentState).toBe("OLD_STATE");
    expect(newContext.someData).toBe("updated value");
  });
});
