import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Lead, LeadStatus } from '../entities/lead.entity';

@Injectable()
export class LeadService {
  private readonly traceleadsApiUrl: string;
  private readonly logger = new Logger(LeadService.name);

  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.traceleadsApiUrl = this.configService.get<string>('TRACELEADS_API_URL') || 'http://localhost:3000';
  }

  async createLead(data: {
    agentId: number;
    companyId: number;
    conversationId?: number;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    status?: LeadStatus;
    metadata?: any;
  }): Promise<Lead> {
    const lead = this.leadRepository.create({
      agentId: data.agentId,
      companyId: data.companyId,
      conversationId: data.conversationId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      status: data.status || LeadStatus.NEW,
      metadata: data.metadata,
    });
    const savedLead = await this.leadRepository.save(lead);

    // Também criar/atualizar no traceleads-api se tiver email
    if (data.email) {
      try {
        const internalServiceKey = this.configService.get<string>('INTERNAL_SERVICE_KEY');
        
        if (!internalServiceKey) {
          this.logger.error(`[Lead] INTERNAL_SERVICE_KEY is not configured. Cannot create lead in traceleads-api.`);
        } else {
          // Formatar notas com metadata se existir
          let notes = `Lead criado via agente de IA`;
          if (data.metadata?.answeredQuestions && Array.isArray(data.metadata.answeredQuestions)) {
            const formattedQuestions = data.metadata.answeredQuestions
              .map((qa: any, index: number) => {
                return `${index + 1}. ${qa.question}\n   Resposta: ${qa.answer}`;
              })
              .join('\n\n');
            notes = `Lead criado via agente de IA.\n\nRespostas coletadas:\n${formattedQuestions}`;
          }

          const leadData = {
            contactName: data.name,
            contactEmail: data.email,
            contactPhone: data.phone,
            notes: notes,
            companyId: data.companyId,
          };

          await firstValueFrom(
            this.httpService.post(
              `${this.traceleadsApiUrl}/leads/internal`,
              leadData,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-internal-service-key': internalServiceKey,
                },
              }
            )
          );

          this.logger.log(`[Lead] Lead created/updated in traceleads-api for agent ${data.agentId}`);
        }
      } catch (error: any) {
        this.logger.error(`[Lead] Error creating/updating lead in traceleads-api:`, error.message);
        // Não falha a criação do lead no ai-agent-backend se falhar no traceleads-api
      }
    }

    return savedLead;
  }

  async findLeadByEmail(email: string, companyId: number, agentId?: number): Promise<Lead | null> {
    const where: any = {
      email,
      companyId,
    };
    if (agentId) {
      where.agentId = agentId;
    }
    return this.leadRepository.findOne({ where });
  }

  async findLeadByConversationId(conversationId: number): Promise<Lead | null> {
    return this.leadRepository.findOne({
      where: { conversationId },
    });
  }

  async updateLead(leadId: number, data: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    status?: LeadStatus;
    conversationId?: number;
    metadata?: any;
  }): Promise<Lead> {
    const lead = await this.leadRepository.findOne({ where: { id: leadId } });
    if (!lead) {
      throw new Error(`Lead with id ${leadId} not found`);
    }

    // Mesclar metadata antes de usar
    const mergedMetadata = data.metadata && lead.metadata 
      ? { ...lead.metadata, ...data.metadata }
      : (data.metadata || lead.metadata);

    if (mergedMetadata) {
      data.metadata = mergedMetadata;
    }

    Object.assign(lead, data);
    const savedLead = await this.leadRepository.save(lead);

    // Também atualizar no traceleads-api se tiver email
    if (lead.email) {
      try {
        const internalServiceKey = this.configService.get<string>('INTERNAL_SERVICE_KEY');
        
        if (!internalServiceKey) {
          this.logger.error(`[Lead] INTERNAL_SERVICE_KEY is not configured. Cannot update lead in traceleads-api.`);
        } else {
          // Formatar notas com metadata mesclado se existir
          let notes = '';
          const finalMetadata = savedLead.metadata || mergedMetadata;
          if (finalMetadata?.answeredQuestions && Array.isArray(finalMetadata.answeredQuestions)) {
            const formattedQuestions = finalMetadata.answeredQuestions
              .map((qa: any, index: number) => {
                return `${index + 1}. ${qa.question}\n   Resposta: ${qa.answer}`;
              })
              .join('\n\n');
            notes = `Lead atualizado via agente de IA.\n\nRespostas coletadas:\n${formattedQuestions}`;
          }

          const leadData: any = {
            contactEmail: lead.email,
            companyId: lead.companyId,
          };

          if (data.name) leadData.contactName = data.name;
          if (data.phone) leadData.contactPhone = data.phone;
          if (notes) leadData.notes = notes;

          await firstValueFrom(
            this.httpService.post(
              `${this.traceleadsApiUrl}/leads/internal`,
              leadData,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-internal-service-key': internalServiceKey,
                },
              }
            )
          );

          this.logger.log(`[Lead] Lead updated in traceleads-api for lead ${leadId}`);
        }
      } catch (error: any) {
        this.logger.error(`[Lead] Error updating lead in traceleads-api:`, error.message);
        // Não falha a atualização do lead no ai-agent-backend se falhar no traceleads-api
      }
    }

    return savedLead;
  }
}


