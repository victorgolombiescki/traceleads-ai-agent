// Re-export from TypeORM service for backwards compatibility
// This allows FSM handlers to continue using the old import path
export { CalendarService } from '../../src/services/calendar.service';
export type { TimeSlot } from '../../src/services/calendar.service';

// Helper functions for FSM handlers
import type { CalendarService } from '../../src/services/calendar.service';
import type { Appointment } from '../../src/entities/appointment.entity';
import type { AppointmentStatus } from '../../src/entities/appointment.entity';
import type { Agent } from '../../src/entities/agent.entity';
import type { TimeSlot } from '../../src/services/calendar.service';

// Create a singleton instance (will be injected properly later)
let calendarServiceInstance: CalendarService | null = null;

export function setCalendarService(service: CalendarService) {
  calendarServiceInstance = service;
}

export async function getAvailableSlots(
  agent: Agent,
  daysAhead: number = 14,
  maxSlots: number = 9,
): Promise<TimeSlot[]> {
  if (!calendarServiceInstance) {
    throw new Error('CalendarService not initialized. Please inject it via dependency injection.');
  }
  return calendarServiceInstance.getAvailableSlots(agent, daysAhead, maxSlots);
}

export async function createAppointment(data: {
  agentId: number;
  conversationId?: number;
  leadId?: number;
  scheduledAt: Date;
  duration?: number;
  status?: AppointmentStatus;
  notes?: string;
  metadata?: any;
}): Promise<Appointment> {
  if (!calendarServiceInstance) {
    throw new Error('CalendarService not initialized. Please inject it via dependency injection.');
  }
  return calendarServiceInstance.createAppointment(data);
}

export async function parseTimeSelection(
  userMessage: string,
  availableSlots: TimeSlot[],
): Promise<TimeSlot | null> {
  if (!calendarServiceInstance) {
    throw new Error('CalendarService not initialized. Please inject it via dependency injection.');
  }
  return calendarServiceInstance.parseTimeSelection(userMessage, availableSlots);
}

