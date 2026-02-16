import type { Agent, Conversation } from "@shared/types";
import { BaseStateHandler, StateHandlerResult } from "../engine";
import { generateResponse } from "../llm-utils";
import { validateStrategicAnswer } from "../llm-utils-v2";
import { createLead, findLeadByConversationId, updateLead } from "../../services/lead-service";
import { getAvailableSlots } from "../../services/calendar-service";

/**
 * CREATING_LEAD - Create a lead record in the database
 * This is a "processing" state that doesn't wait for user input
 */
export class CreatingLeadStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    const { customerName, customerEmail, customerPhone } = conversation.context;

    // Create the lead if we have all required data
    let leadId: number | undefined;
    if (customerName && customerEmail) {
      try {
        const lead = await createLead({
          agentId: agent.id,
          companyId: agent.companyId,
          conversationId: conversation.id,
          name: customerName,
          email: customerEmail,
          phone: customerPhone || undefined,
          metadata: {
            source: "agent_conversation",
            collectedAt: new Date().toISOString(),
          },
        });
        leadId = lead.id;

        // Check if there are strategic questions to ask
        const strategicQuestions = agent.behaviorConfig?.strategicQuestions || [];
        
        if (strategicQuestions.length > 0) {
          const firstQuestion = strategicQuestions[0];
          
          return {
            response: firstQuestion,
            newContext: this.transitionTo(conversation.context, "ASKING_STRATEGIC_QUESTIONS", {
              leadId: lead.id,
              answeredQuestions: [],
            }),
          };
        }

        // No questions - check if calendar is enabled
        const enableCalendar = agent.behaviorConfig?.enableCalendar !== false;
        
        if (enableCalendar) {
          return {
            response: "Perfeito! Agora vamos encontrar um horário ideal para conversarmos.",
            newContext: this.transitionTo(conversation.context, "SHOWING_CALENDAR_OPTIONS", {
              leadId: leadId,
            }),
          };
        } else {
          // Skip calendar, go straight to completion
          const companyName = agent.behaviorConfig?.companyName || "nossa equipe";
          return {
            response: `Obrigado pelas informações! Em breve entraremos em contato. 😊\n\n- Equipe ${companyName}`,
            newContext: this.transitionTo(conversation.context, "COMPLETED", {
              leadId: leadId,
            }),
          };
        }
      } catch (error) {
        console.error("[CreatingLeadStateHandler] Failed to create lead:", error);
        
        // Continue anyway, but log the error
        return {
          response: "Obrigado pelas informações! Vamos continuar.",
          newContext: this.transitionTo(conversation.context, "ASKING_STRATEGIC_QUESTIONS", {
            answeredQuestions: [],
          }),
        };
      }
    }

    // Missing required data - shouldn't happen, but handle gracefully
    return {
      response: "Desculpe, parece que faltam algumas informações. Vamos recomeçar.",
      newContext: this.transitionTo(conversation.context, "COLLECTING_NAME"),
    };
  }
}

/**
 * ASKING_STRATEGIC_QUESTIONS - Ask configured questions and collect answers
 */
export class AskingQuestionsStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    const context = conversation.context;
    const strategicQuestions = agent.behaviorConfig?.strategicQuestions || [];
    let answeredQuestions = context.answeredQuestions || [];
    
    // If this is not the first entry to this state (user has sent a message)
    // Validate and save the answer to the current question
    if (userMessage.trim() && answeredQuestions.length < strategicQuestions.length) {
      const currentQuestion = strategicQuestions[answeredQuestions.length];
      
      // Validate if the response is valid for this question
      const validation = await validateStrategicAnswer(currentQuestion, userMessage.trim());
      
      if (!validation.isValid) {
        // Response is not valid - ask again with empathy
        const companyName = agent.behaviorConfig?.companyName || "nossa equipe";
        const retryPrompt = `Você é o assistente virtual da ${companyName}. O usuário respondeu "${userMessage.trim()}" para a pergunta "${currentQuestion}", mas a resposta não foi adequada porque ${validation.reason}.

Gere uma mensagem curta e direta (1-2 linhas) que:
1. Reconheça brevemente a resposta dele de forma empática
2. Reformule a pergunta de forma mais clara e específica
3. Incentive o usuário a compartilhar mais detalhes

NÃO mencione segurança de dados, privacidade ou outros assuntos. Foque APENAS em pedir uma resposta mais específica para a pergunta.

Exemplo de resposta curta:
- "Entendo! Para te ajudar melhor, poderia me contar qual é o principal desafio que você enfrenta no seu negócio?"
- "Oi! Que bom te ver aqui! Poderia compartilhar um pouco mais sobre [tema da pergunta]?"`;

        const retryResponse = await generateResponse(retryPrompt, "", []);
        
        return {
          response: retryResponse,
          newContext: this.stayInState(context, {
            answeredQuestions, // Don't save invalid answer
          }),
        };
      }
      
      // Response is valid - save it
      answeredQuestions = [
        ...answeredQuestions,
        {
          question: currentQuestion,
          answer: userMessage.trim(),
        },
      ];
      
      console.log(`[AskingQuestions] Saved valid answer ${answeredQuestions.length}/${strategicQuestions.length}`);
    }

    if (answeredQuestions.length >= strategicQuestions.length) {
      const { leadId } = context;
      if (leadId) {
        try {
          const lead = await findLeadByConversationId(conversation.id);
          if (lead) {
            const currentMetadata = lead.metadata || {};
            await updateLead(lead.id, {
              metadata: {
                ...currentMetadata,
                answeredQuestions: answeredQuestions,
                questionsCompletedAt: new Date().toISOString(),
              },
            });
            console.log(`[AskingQuestions] Updated lead ${lead.id} with ${answeredQuestions.length} strategic answers`);
          }
        } catch (error) {
          console.error("[AskingQuestions] Failed to update lead with answers:", error);
        }
      }

      const enableCalendar = agent.behaviorConfig?.enableCalendar !== false;
      
      if (enableCalendar) {
        const slots = await getAvailableSlots(agent, 14, 9);
        
        if (slots.length === 0) {
          const companyName = agent.behaviorConfig?.companyName || "nossa equipe";
          const noSlotsPrompt = `Você é um assistente de vendas empático. Com base nas respostas do cliente, gere uma mensagem de fechamento profissional (2-3 linhas) agradecendo e informando que a equipe entrará em contato.

Respostas do cliente:
${answeredQuestions.map((qa, i) => `${i + 1}. ${qa.question}\nResposta: ${qa.answer}`).join('\n\n')}

Gere uma resposta que:
1. Mostre que você entendeu as necessidades
2. Agradeça pela disponibilidade
3. Informe que a equipe entrará em contato em breve
4. NÃO mencione horários, agendamento ou disponibilidade

Exemplo: "Perfeito! Entendi suas necessidades com [mencionar]. Muito obrigado pelas informações. Nossa equipe analisará seu caso e entrará em contato em breve. Até logo! 😊"`;

          const noSlotsResponse = await generateResponse(noSlotsPrompt, "", []);
          
          return {
            response: noSlotsResponse,
            newContext: this.transitionTo(context, "COMPLETED", {
              answeredQuestions,
            }),
          };
        }
        
        // Se houver slots, gerar diagnóstico e mostrar opções diretamente
        const diagnosisPrompt = `Você é um assistente de vendas empático. Com base nas respostas do cliente, gere um diagnóstico curto (2-3 linhas) que mostre que você entendeu os desafios/necessidades dele.

Respostas do cliente:
${answeredQuestions.map((qa, i) => `${i + 1}. ${qa.question}\nResposta: ${qa.answer}`).join('\n\n')}

Gere uma resposta que:
1. Mostre que você entendeu os desafios/necessidades dele
2. Seja empático e profissional
3. NÃO mencione horários ainda (eles serão mostrados depois)

Exemplo: "Entendi seus desafios com [problema mencionado]. Com base no que você compartilhou, acredito que podemos ajudar bastante."`;

        const transitionResponse = await generateResponse(diagnosisPrompt, "", []);
        
        // Formatar slots como lista numerada
        const slotsList = slots
          .map((slot, index) => `${index + 1}. ${slot.formatted}`)
          .join("\n");
        
        // Combinar a transição com as opções de calendário
        const responseWithSlots = `${transitionResponse}\n\nAqui estão os horários disponíveis:\n\n${slotsList}\n\nQual horário funciona melhor para você? Pode responder com o número da opção (ex: "1") ou descrever o horário.`;
        
        return {
          response: responseWithSlots,
          newContext: this.transitionTo(context, "CONFIRMING_APPOINTMENT", {
            answeredQuestions,
            availableSlots: slots,
          }),
        };
      } else {
        // No calendar - generate closing message
        const companyName = agent.behaviorConfig?.companyName || "nossa equipe";
        const closingPrompt = `Você é um assistente de vendas empático. Com base nas respostas do cliente, gere uma mensagem de fechamento profissional (2-3 linhas) agradecendo e informando que a equipe entrará em contato.

Respostas do cliente:
${answeredQuestions.map((qa, i) => `${i + 1}. ${qa.question}\nResposta: ${qa.answer}`).join('\n\n')}

Gere uma resposta que:
1. Mostre que você entendeu as necessidades
2. Agradeça pela disponibilidade
3. Informe que a equipe entrará em contato em breve

Exemplo: "Perfeito! Entendi suas necessidades com [mencionar]. Muito obrigado pelas informações. Nossa equipe analisará seu caso e entrará em contato em breve. Até logo! 😊"`;

        const closingResponse = await generateResponse(closingPrompt, "", []);

        return {
          response: closingResponse,
          newContext: this.transitionTo(context, "COMPLETED", {
            answeredQuestions,
          }),
        };
      }
    }

    // Ask the next question
    const nextQuestionIndex = answeredQuestions.length;
    const nextQuestion = strategicQuestions[nextQuestionIndex];
    
    return {
      response: nextQuestion,
      newContext: this.stayInState(context, {
        answeredQuestions,
      }),
    };
  }
}

/**
 * COMPLETED - Final state, conversation is done
 */
export class CompletedStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    const companyName = agent.behaviorConfig?.companyName || "nossa equipe";
    
    return {
      response: `Obrigado por conversar comigo! Se precisar de mais alguma coisa, estou à disposição. Até breve! 😊\n\n- Equipe ${companyName}`,
      newContext: this.stayInState(conversation.context),
    };
  }
}

/**
 * ERROR - Handle errors gracefully
 */
export class ErrorStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    return {
      response: "Desculpe, ocorreu um erro inesperado. Vamos tentar novamente. Por favor, me diga seu nome para recomeçarmos.",
      newContext: this.transitionTo(conversation.context, "COLLECTING_NAME", {
        lastError: conversation.context.lastError,
        errorRecoveryAttempt: (conversation.context.errorRecoveryAttempt || 0) + 1,
      }),
    };
  }
}
