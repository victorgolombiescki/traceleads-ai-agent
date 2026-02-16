import type { Agent, Conversation } from "@shared/types";
import { BaseStateHandler, StateHandlerResult } from "../engine";
import { invokeLLM } from "../../core/llm";
import { getAvailableSlots, createAppointment, type TimeSlot } from "../../services/calendar-service";
import { AppointmentStatus } from "../../entities/appointment.entity";

/**
 * Formata as respostas coletadas em um formato legível
 */
function formatAnsweredQuestions(answeredQuestions: Array<{ question: string; answer: string }> | undefined): string {
  if (!answeredQuestions || answeredQuestions.length === 0) {
    return "Nenhuma resposta coletada.";
  }

  return answeredQuestions
    .map((qa, index) => {
      return `${index + 1}. ${qa.question}\n   Resposta: ${qa.answer}`;
    })
    .join("\n\n");
}

/**
 * NEGOTIATING_CALENDAR - Intelligent calendar negotiation with function calling
 * The agent converses naturally and uses functions to query/book appointments
 */
export class NegotiatingCalendarStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    const companyName = agent.behaviorConfig?.companyName || "nossa equipe";
    const customerName = conversation.context.customerName || "você";

    // Get available slots
    const availableSlots = await getAvailableSlots(agent, 14, 15);

    if (availableSlots.length === 0) {
      return {
        response: `Desculpe, no momento não temos horários disponíveis nas próximas semanas. Nossa equipe entrará em contato com você em breve pelo e-mail ou telefone fornecido.\n\nObrigado pelo interesse!\n- Equipe ${companyName}`,
        newContext: this.transitionTo(conversation.context, "COMPLETED"),
      };
    }

    // Build conversation history for LLM
    const conversationHistory = conversation.context.calendarMessages || [];
    
    // Define functions for the LLM
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "get_available_slots",
          description: "Consulta os horários disponíveis para agendamento. Use esta função quando o usuário perguntar sobre disponibilidade ou quando precisar sugerir horários alternativos.",
          parameters: {
            type: "object",
            properties: {
              preference: {
                type: "string",
                description: "Preferência do usuário (ex: 'manhã', 'tarde', 'segunda-feira', 'próxima semana')",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "book_appointment",
          description: "Reserva um horário específico após confirmação do usuário. Use apenas quando o usuário confirmar explicitamente que quer aquele horário.",
          parameters: {
            type: "object",
            properties: {
              slot_index: {
                type: "number",
                description: "Índice do slot na lista de disponíveis (0-based)",
              },
              confirmation: {
                type: "string",
                description: "Confirmação do usuário sobre o horário escolhido",
              },
            },
            required: ["slot_index", "confirmation"],
          },
        },
      },
    ];

    // System prompt for intelligent negotiation
    const systemPrompt = `Você é um assistente de agendamento da ${companyName}. Seu objetivo é agendar uma reunião com ${customerName} de forma natural e amigável.

HORÁRIOS DISPONÍVEIS:
${availableSlots.map((slot, i) => `${i}. ${slot.formatted}`).join('\n')}

INSTRUÇÕES:
1. Converse naturalmente sobre disponibilidade
2. Sugira horários baseado nas preferências do usuário
3. Se o usuário rejeitar, use get_available_slots para buscar alternativas
4. Quando o usuário confirmar um horário, use book_appointment
5. Seja flexível e proativo em encontrar um horário que funcione
6. Use emojis com moderação para ser amigável

IMPORTANTE:
- NÃO liste todos os horários de uma vez
- Sugira 2-3 opções por vez baseado no que o usuário prefere
- Se não gostar, pergunte a preferência e sugira outras opções
- Só reserve quando houver confirmação clara`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory,
      { role: "user" as const, content: userMessage },
    ];

    try {
      const response = await invokeLLM({
        messages,
        tools,
        tool_choice: "auto",
      });

      const assistantMessage = response.choices[0]?.message;
      
      if (!assistantMessage) {
        throw new Error("No response from LLM");
      }

      // Update conversation history
      const assistantContent = typeof assistantMessage.content === 'string' 
        ? assistantMessage.content 
        : JSON.stringify(assistantMessage.content);
      
      const updatedHistory = [
        ...conversationHistory,
        { role: "user" as const, content: userMessage },
        { role: "assistant" as const, content: assistantContent || "" },
      ];

      // Check if LLM wants to call a function
      const toolCalls = assistantMessage.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        if (functionName === "book_appointment") {
          // Book the appointment
          const slotIndex = functionArgs.slot_index;
          const selectedSlot = availableSlots[slotIndex];

          if (!selectedSlot) {
            return {
              response: "Desculpe, houve um erro ao identificar o horário. Vamos tentar novamente. Qual horário você prefere?",
              newContext: this.stayInState(conversation.context, {
                calendarMessages: updatedHistory,
              }),
            };
          }

          // Create the appointment
          const appointment = await createAppointment({
            agentId: agent.id,
            companyId: agent.companyId,
            conversationId: conversation.id,
            leadId: conversation.context.leadId as number | undefined,
            scheduledAt: selectedSlot.start,
            duration: 60,
            status: AppointmentStatus.SCHEDULED,
            notes: `Agendado via agente de IA (negociação inteligente).\n\nRespostas coletadas:\n${formatAnsweredQuestions(conversation.context.answeredQuestions as Array<{ question: string; answer: string }> | undefined)}`,
            attendeeName: conversation.context.customerName,
            attendeeEmail: conversation.context.customerEmail,
            attendeePhone: conversation.context.customerPhone,
            userId: (agent.behaviorConfig as any)?.calendarUserId,
          });

          const confirmationResponse = `Perfeito! ✅ Seu horário está confirmado:\n\n📅 ${selectedSlot.formatted}\n\nVocê receberá uma confirmação por e-mail com todos os detalhes. Estamos ansiosos para conversar com você, ${customerName}!\n\nSe precisar reagendar ou tiver alguma dúvida, é só entrar em contato.\n\nAté breve!\n- Equipe ${companyName}`;

          return {
            response: confirmationResponse,
            newContext: this.transitionTo(conversation.context, "COMPLETED", {
              appointmentId: appointment.id,
              selectedSlot: selectedSlot.formatted,
            }),
          };
        } else if (functionName === "get_available_slots") {
          // LLM wants to query slots (for alternative suggestions)
          // In this case, we already have the slots, so just continue the conversation
          // The LLM will use the slots list in the next response
          
          // Get a follow-up response from LLM with the function result
          const followUpMessages = [
            ...messages,
            assistantMessage,
            {
              role: "tool" as const,
              content: JSON.stringify({
                available_slots: availableSlots.map((slot, i) => ({
                  index: i,
                  formatted: slot.formatted,
                })),
              }),
              tool_call_id: toolCall.id,
            },
          ];

          const followUpResponse = await invokeLLM({
            messages: followUpMessages,
            tools,
            tool_choice: "auto",
          });

          const followUpMessage = followUpResponse.choices[0]?.message;
          const followUpContent = typeof followUpMessage?.content === 'string'
            ? followUpMessage.content
            : (followUpMessage?.content ? JSON.stringify(followUpMessage.content) : "Vamos encontrar um horário que funcione para você!");

          return {
            response: followUpContent,
            newContext: this.stayInState(conversation.context, {
              calendarMessages: [
                ...updatedHistory,
                { role: "assistant" as const, content: followUpContent },
              ],
            }),
          };
        }
      }

      // No function call, just regular conversation
      const responseText = typeof assistantMessage.content === 'string'
        ? assistantMessage.content
        : (assistantMessage.content ? JSON.stringify(assistantMessage.content) : "Vamos encontrar um horário ideal para você!");

      return {
        response: responseText,
        newContext: this.stayInState(conversation.context, {
          calendarMessages: updatedHistory,
        }),
      };
    } catch (error) {
      console.error("[NegotiatingCalendarStateHandler] Error:", error);

      return {
        response: `Desculpe, tive um problema ao processar o agendamento. Nossa equipe entrará em contato com você em breve.\n\nObrigado!\n- Equipe ${companyName}`,
        newContext: this.transitionTo(conversation.context, "COMPLETED"),
      };
    }
  }
}
