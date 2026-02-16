import type { Agent, Conversation } from "@shared/types";
import { BaseStateHandler, StateHandlerResult } from "../engine";
import { getAvailableSlots, createAppointment, parseTimeSelection, type TimeSlot } from "../../services/calendar-service";
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
 * SHOWING_CALENDAR_OPTIONS - Display available time slots
 */
export class ShowingCalendarStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    try {
      const slots = await getAvailableSlots(agent, 14, 9);

      if (slots.length === 0) {
        return {
          response: "Desculpe, no momento não temos horários disponíveis. Nossa equipe entrará em contato com você em breve pelo e-mail ou telefone fornecido.",
          newContext: this.transitionTo(conversation.context, "COMPLETED"),
        };
      }

      // Format slots as a numbered list
      const slotsList = slots
        .map((slot, index) => `${index + 1}. ${slot.formatted}`)
        .join("\n");

      const response = `Ótimo! Aqui estão os horários disponíveis para nossa conversa:\n\n${slotsList}\n\nQual horário funciona melhor para você? Pode responder com o número da opção ou descrever o horário.`;

      return {
        response,
        newContext: this.transitionTo(conversation.context, "CONFIRMING_APPOINTMENT", {
          availableSlots: slots,
        }),
      };
    } catch (error) {
      console.error("[ShowingCalendarStateHandler] Error:", error);
      
      return {
        response: "Desculpe, tive um problema ao buscar os horários disponíveis. Nossa equipe entrará em contato com você em breve.",
        newContext: this.transitionTo(conversation.context, "COMPLETED"),
      };
    }
  }
}

/**
 * CONFIRMING_APPOINTMENT - Parse user selection and create appointment
 */
export class ConfirmingAppointmentStateHandler extends BaseStateHandler {
  async process(
    agent: Agent,
    conversation: Conversation,
    userMessage: string,
  ): Promise<StateHandlerResult> {
    const availableSlots = conversation.context.availableSlots as TimeSlot[] | undefined;

    if (!availableSlots || availableSlots.length === 0) {
      return {
        response: "Desculpe, parece que perdemos as opções de horário. Vamos tentar novamente.",
        newContext: this.transitionTo(conversation.context, "SHOWING_CALENDAR_OPTIONS"),
      };
    }

    // Parse the user's selection
    const selectedSlot = await parseTimeSelection(userMessage, availableSlots);

    if (!selectedSlot) {
      // Couldn't understand the selection
      const slotsList = availableSlots
        .map((slot, index) => `${index + 1}. ${slot.formatted}`)
        .join("\n");

      return {
        response: `Desculpe, não consegui identificar qual horário você escolheu. Por favor, escolha um dos horários abaixo:\n\n${slotsList}\n\nVocê pode responder com o número da opção (ex: "2") ou descrever o horário.`,
        newContext: this.stayInState(conversation.context),
      };
    }

    // Create the appointment
    try {
      const appointment = await createAppointment({
        agentId: agent.id,
        companyId: agent.companyId,
        conversationId: conversation.id,
        leadId: conversation.context.leadId as number | undefined,
        scheduledAt: selectedSlot.start,
        duration: agent.behaviorConfig?.calendarConfig?.slotDuration || 60,
        status: AppointmentStatus.SCHEDULED,
        notes: `Agendado via agente de IA.\n\nRespostas coletadas:\n${formatAnsweredQuestions(conversation.context.answeredQuestions as Array<{ question: string; answer: string }> | undefined)}`,
        attendeeName: conversation.context.customerName,
        attendeeEmail: conversation.context.customerEmail,
        attendeePhone: conversation.context.customerPhone,
        userId: (agent.behaviorConfig as any)?.calendarUserId,
      });

      const companyName = agent.behaviorConfig?.companyName || "nossa equipe";
      const customerName = conversation.context.customerName || "você";

      const response = `Perfeito! ✅ Seu horário está confirmado:\n\n📅 ${selectedSlot.formatted}\n\nVocê receberá uma confirmação por e-mail com todos os detalhes. Estamos ansiosos para conversar com você, ${customerName}!\n\nSe precisar reagendar ou tiver alguma dúvida, é só entrar em contato.\n\nAté breve!\n- Equipe ${companyName}`;

      return {
        response,
        newContext: this.transitionTo(conversation.context, "COMPLETED", {
          appointmentId: appointment.id,
          selectedSlot: selectedSlot.formatted,
        }),
      };
    } catch (error) {
      console.error("[ConfirmingAppointmentStateHandler] Error creating appointment:", error);

      return {
        response: "Desculpe, tive um problema ao confirmar o agendamento. Nossa equipe entrará em contato com você em breve para confirmar o horário.",
        newContext: this.transitionTo(conversation.context, "COMPLETED"),
      };
    }
  }
}
