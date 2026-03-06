import { Module } from '@nestjs/common';
import { OutboundService } from './outbound.service';

/**
 * Módulo Outbound: prospecção ativa via WhatsApp.
 * Isolado do fluxo inbound (FSM/conversations existentes).
 * Próximos passos: FSM outbound, integração com traceleads-api (perfis/campanhas/targets).
 */
@Module({
  providers: [OutboundService],
  exports: [OutboundService],
})
export class OutboundModule {}
