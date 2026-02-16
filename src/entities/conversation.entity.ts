import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Agent } from './agent.entity';
import { Message } from './message.entity';
import { Lead } from './lead.entity';
import { Appointment } from './appointment.entity';

export enum ConversationStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ERROR = 'error',
}

export interface ConversationContext {
  currentState: string;
  [key: string]: any;
}

@Entity('ia_conversations')
@Index(['agentId'])
@Index(['companyId'])
@Index(['externalId'])
@Index(['status'])
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'agent_id', type: 'integer' })
  agentId: number;

  @ManyToOne(() => Agent, (agent) => agent.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ name: 'company_id', type: 'integer' })
  companyId: number;

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId?: string;

  @Column({ name: 'current_state', type: 'varchar', length: 100 })
  currentState: string;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.ACTIVE,
  })
  status: ConversationStatus;

  @Column({ type: 'jsonb' })
  context: ConversationContext;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @OneToMany(() => Lead, (lead) => lead.conversation)
  leads: Lead[];

  @OneToMany(() => Appointment, (appointment) => appointment.conversation)
  appointments: Appointment[];
}


