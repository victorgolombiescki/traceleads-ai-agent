// Re-export from TypeORM service for backwards compatibility
// This allows FSM handlers to continue using the old import path
export { LeadService } from './lead.service';

// Helper function for FSM handlers
import type { LeadService } from './lead.service';
import type { Lead } from '../entities/lead.entity';
import type { LeadStatus } from '../entities/lead.entity';

// Create a singleton instance (will be injected properly later)
let leadServiceInstance: LeadService | null = null;

export function setLeadService(service: LeadService) {
  leadServiceInstance = service;
}

export async function createLead(data: {
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
  if (!leadServiceInstance) {
    throw new Error('LeadService not initialized. Please inject it via dependency injection.');
  }
  return leadServiceInstance.createLead(data);
}

export async function findLeadByEmail(email: string, companyId: number, agentId?: number): Promise<Lead | null> {
  if (!leadServiceInstance) {
    throw new Error('LeadService not initialized. Please inject it via dependency injection.');
  }
  return leadServiceInstance.findLeadByEmail(email, companyId, agentId);
}

export async function findLeadByConversationId(conversationId: number): Promise<Lead | null> {
  if (!leadServiceInstance) {
    throw new Error('LeadService not initialized. Please inject it via dependency injection.');
  }
  return leadServiceInstance.findLeadByConversationId(conversationId);
}

export async function updateLead(leadId: number, data: {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: LeadStatus;
  conversationId?: number;
  metadata?: any;
}): Promise<Lead> {
  if (!leadServiceInstance) {
    throw new Error('LeadService not initialized. Please inject it via dependency injection.');
  }
  return leadServiceInstance.updateLead(leadId, data);
}

