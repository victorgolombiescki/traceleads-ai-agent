import { Injectable, Logger } from '@nestjs/common';

/**
 * Serviço do módulo Outbound (prospecção ativa via WhatsApp).
 * Responsável pelo fluxo de diálogo até agendamento de reunião.
 *
 * TODO: Integrar com traceleads-api (perfil/campanha/targets).
 * TODO: Implementar FSM específico para outbound (template inicial + diálogo).
 * O fluxo inbound (FSM existente) permanece inalterado.
 */
@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  /**
   * Retorna a configuração do perfil outbound (para uso futuro pelo FSM outbound).
   * Por enquanto apenas placeholder; a config virá do traceleads-api.
   */
  getProfileConfig(_profileId: number): { fsmConfig: unknown; initialTemplateName: string | null } {
    this.logger.debug('OutboundService.getProfileConfig called (placeholder)');
    return { fsmConfig: null, initialTemplateName: null };
  }

  /**
   * Processa uma mensagem recebida em contexto outbound (resposta do lead).
   * TODO: Chamado quando o webhook/conversa for identificada como outbound;
   * executar transição do FSM outbound e gerar resposta.
   * Por enquanto retorna explicitamente sem resposta (quem chamar pode ignorar ou não enviar mensagem).
   */
  async processOutboundMessage(
    _externalConversationId: string,
    _profileId: number,
    _messageText: string,
  ): Promise<{ reply: string | null; state: string | null }> {
    this.logger.debug('OutboundService.processOutboundMessage called (placeholder)');
    return { reply: null, state: null };
  }
}
