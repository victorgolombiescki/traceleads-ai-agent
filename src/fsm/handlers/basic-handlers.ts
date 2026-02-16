import type { Agent, Conversation } from "@shared/types";
import { BaseStateHandler, StateHandlerResult } from "../engine";
import { extractTextField, isValidEmail, isValidPhone, formatPhone } from "../llm-utils";
import { detectQuestionOrObjection, generateExplanation } from "../llm-utils-v2";
import { createLead, findLeadByEmail, updateLead } from "../../services/lead-service";

/**
 * INITIALIZING - Welcome the user and start the conversation
 */
export class InitializingStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    const companyName = agent.behaviorConfig?.companyName || "nossa empresa";
    
    const response = `Olá! Sou o assistente virtual da ${companyName}. É um prazer falar com você! 😊\n\nPara começarmos, qual é o seu nome?`;

    return {
      response,
      newContext: this.transitionTo(conversation.context, "COLLECTING_NAME"),
    };
  }
}

/**
 * COLLECTING_NAME - Extract and validate the user's name
 */
export class CollectingNameStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    // First, check if user is asking a question or objecting
    const { isQuestion } = await detectQuestionOrObjection(userMessage, "name");
    
    if (isQuestion) {
      const companyName = agent.behaviorConfig?.companyName || "nossa empresa";
      const explanation = await generateExplanation(companyName, "name", userMessage);
      
      return {
        response: explanation,
        newContext: this.stayInState(conversation.context),
      };
    }

    // Try to extract the name
    const name = await extractTextField(
      "name",
      "o nome completo da pessoa",
      userMessage,
    );

    if (name && name.length >= 2) {
      const response = `Prazer em conhecê-lo, ${name}! 👋\n\nAgora, qual é o seu melhor e-mail para contato?`;

      return {
        response,
        newContext: this.transitionTo(conversation.context, "COLLECTING_EMAIL", {
          customerName: name,
        }),
      };
    }

    // Failed to extract name
    return {
      response: "Desculpe, não consegui entender seu nome. Poderia me informar novamente, por favor?",
      newContext: this.stayInState(conversation.context),
    };
  }
}

/**
 * COLLECTING_EMAIL - Extract and validate the user's email
 */
export class CollectingEmailStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    // Check for questions/objections
    const { isQuestion } = await detectQuestionOrObjection(userMessage, "email");
    
    if (isQuestion) {
      const companyName = agent.behaviorConfig?.companyName || "nossa empresa";
      const explanation = await generateExplanation(companyName, "email", userMessage);
      
      return {
        response: explanation,
        newContext: this.stayInState(conversation.context),
      };
    }

    const email = await extractTextField(
      "email",
      "o endereço de e-mail",
      userMessage,
    );

    if (email && isValidEmail(email)) {
      const { customerName } = conversation.context;
      
      let leadId: number | undefined;
      if (customerName && email) {
        try {
          const existingLead = await findLeadByEmail(email, agent.companyId, agent.id);
          
          if (existingLead) {
            await updateLead(existingLead.id, {
              name: customerName,
              email: email,
              conversationId: conversation.id,
            });
            leadId = existingLead.id;
            console.log(`[CollectingEmail] Updated existing lead ${leadId} with name and email`);
          } else {
            const lead = await createLead({
              agentId: agent.id,
              companyId: agent.companyId,
              conversationId: conversation.id,
              name: customerName,
              email: email,
              metadata: {
                source: "agent_conversation",
                collectedAt: new Date().toISOString(),
              },
            });
            leadId = lead.id;
            console.log(`[CollectingEmail] Created new lead ${leadId} with name and email`);
          }
        } catch (error) {
          console.error("[CollectingEmail] Failed to create/update lead:", error);
        }
      }

      const response = `Perfeito! Recebi seu e-mail: ${email} ✅\n\nPor último, qual é o seu telefone com DDD? (Ex: (11) 98765-4321)`;

      return {
        response,
        newContext: this.transitionTo(conversation.context, "COLLECTING_PHONE", {
          customerEmail: email,
          leadId,
        }),
      };
    }

    // Failed to extract or validate email
    return {
      response: "Não consegui identificar um e-mail válido. Você poderia informar novamente, por favor? (Ex: seunome@email.com)",
      newContext: this.stayInState(conversation.context),
    };
  }
}

/**
 * COLLECTING_PHONE - Extract and validate the user's phone
 */
export class CollectingPhoneStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    // Check for questions/objections
    const { isQuestion } = await detectQuestionOrObjection(userMessage, "phone");
    
    if (isQuestion) {
      const companyName = agent.behaviorConfig?.companyName || "nossa empresa";
      const explanation = await generateExplanation(companyName, "phone", userMessage);
      
      return {
        response: explanation,
        newContext: this.stayInState(conversation.context),
      };
    }

    const phone = await extractTextField(
      "phone",
      "o número de telefone com DDD",
      userMessage,
    );

    if (phone && isValidPhone(phone)) {
      const formattedPhone = formatPhone(phone);
      const { customerName, customerEmail, leadId: existingLeadId } = conversation.context;

      // Atualizar o lead existente com o telefone
      let leadId: number | undefined = existingLeadId as number | undefined;
      
      if (leadId) {
        try {
          // Atualizar lead existente com telefone
          await updateLead(leadId, {
            phone: formattedPhone,
          });
          console.log(`[CollectingPhone] Updated lead ${leadId} with phone`);
        } catch (error) {
          console.error("[CollectingPhone] Failed to update lead:", error);
        }
      } else if (customerName && customerEmail) {
        // Se não tiver leadId mas tiver nome e email, criar novo (fallback)
        try {
          const lead = await createLead({
            agentId: agent.id,
            companyId: agent.companyId,
            conversationId: conversation.id,
            name: customerName,
            email: customerEmail,
            phone: formattedPhone,
            metadata: {
              source: "agent_conversation",
              collectedAt: new Date().toISOString(),
            },
          });
          leadId = lead.id;
          console.log(`[CollectingPhone] Created new lead ${leadId} with phone (fallback)`);
        } catch (error) {
          console.error("[CollectingPhone] Failed to create lead:", error);
        }
      }

      // Check if there are strategic questions to ask
      const strategicQuestions = agent.behaviorConfig?.strategicQuestions || [];
      
      if (strategicQuestions.length > 0) {
        const firstQuestion = strategicQuestions[0];
        const response = `Ótimo! Telefone registrado: ${formattedPhone} 📱\n\nAgora vou fazer algumas perguntas rápidas para entender melhor como podemos ajudá-lo.\n\n${firstQuestion}`;
        
        return {
          response,
          newContext: this.transitionTo(conversation.context, "ASKING_STRATEGIC_QUESTIONS", {
            customerPhone: formattedPhone,
            leadId,
            answeredQuestions: [],
          }),
        };
      }

      // No questions - check if calendar is enabled
      const enableCalendar = agent.behaviorConfig?.enableCalendar !== false;
      
      if (enableCalendar) {
        return {
          response: `Ótimo! Telefone registrado: ${formattedPhone} 📱\n\nPerfeito! Agora vamos encontrar um horário ideal para conversarmos.`,
          newContext: this.transitionTo(conversation.context, "SHOWING_CALENDAR_OPTIONS", {
            customerPhone: formattedPhone,
            leadId,
          }),
        };
      } else {
        // Skip calendar, go straight to completion
        const companyName = agent.behaviorConfig?.companyName || "nossa equipe";
        return {
          response: `Ótimo! Telefone registrado: ${formattedPhone} 📱\n\nObrigado pelas informações! Em breve entraremos em contato. 😊\n\n- Equipe ${companyName}`,
          newContext: this.transitionTo(conversation.context, "COMPLETED", {
            customerPhone: formattedPhone,
            leadId,
          }),
        };
      }
    }

    // Failed to extract or validate phone
    return {
      response: "Não consegui identificar um telefone válido. Poderia informar novamente com o DDD? (Ex: 11987654321 ou (11) 98765-4321)",
      newContext: this.stayInState(conversation.context),
    };
  }
}
