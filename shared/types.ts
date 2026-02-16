// Re-export entity types for backwards compatibility
export type { Agent } from '../src/entities/agent.entity';
export type { Conversation, ConversationContext } from '../src/entities/conversation.entity';
export type { User } from '../src/entities/user.entity';
export type { Message } from '../src/entities/message.entity';
export type { Lead } from '../src/entities/lead.entity';
export type { Appointment } from '../src/entities/appointment.entity';
export type { TimeSlot } from '../src/services/calendar.service';

// Re-export enums
export { ConversationStatus } from '../src/entities/conversation.entity';
export { LeadStatus } from '../src/entities/lead.entity';
export { AppointmentStatus } from '../src/entities/appointment.entity';
