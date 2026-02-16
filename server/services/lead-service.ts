// Re-export from TypeORM service for backwards compatibility
// This allows FSM handlers to continue using the old import path
export { LeadService } from '../../src/services/lead.service';

// Helper function for FSM handlers
import type { LeadService } from '../../src/services/lead.service';
import type { Lead } from '../../src/entities/lead.entity';
import type { LeadStatus } from '../../src/entities/lead.entity';

// Create a singleton instance (will be injected properly later)
let leadServiceInstance: LeadService | null = null;

export function setLeadService(service: LeadService) {
  leadServiceInstance = service;
}

export async function createLead(data: {
  agentId: number;
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

