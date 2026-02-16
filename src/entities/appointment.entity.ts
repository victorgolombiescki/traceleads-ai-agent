import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Agent } from './agent.entity';
import { Conversation } from './conversation.entity';
import { Lead } from './lead.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('ia_appointments')
@Index(['agentId'])
@Index(['companyId'])
@Index(['conversationId'])
@Index(['leadId'])
@Index(['scheduledAt'])
@Index(['status'])
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'agent_id', type: 'integer' })
  agentId: number;

  @ManyToOne(() => Agent, (agent) => agent.appointments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ name: 'conversation_id', type: 'integer', nullable: true })
  conversationId?: number;

  @ManyToOne(() => Conversation, (conversation) => conversation.appointments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Column({ name: 'lead_id', type: 'integer', nullable: true })
  leadId?: number;

  @ManyToOne(() => Lead, (lead) => lead.appointments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'lead_id' })
  lead?: Lead;

  @Column({ name: 'company_id', type: 'integer' })
  companyId: number;

  @Column({ name: 'scheduled_at', type: 'timestamp' })
  scheduledAt: Date;

  @Column({ type: 'integer', default: 60 })
  duration: number; // minutes

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED,
  })
  status: AppointmentStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    [key: string]: any;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


