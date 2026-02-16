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
import { Conversation } from './conversation.entity';
import { Appointment } from './appointment.entity';

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  CONVERTED = 'converted',
  LOST = 'lost',
}

@Entity('ia_leads')
@Index(['agentId'])
@Index(['companyId'])
@Index(['conversationId'])
@Index(['status'])
@Index(['email'])
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'agent_id', type: 'integer' })
  agentId: number;

  @ManyToOne(() => Agent, (agent) => agent.leads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ name: 'conversation_id', type: 'integer', nullable: true })
  conversationId?: number;

  @ManyToOne(() => Conversation, (conversation) => conversation.leads, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Column({ name: 'company_id', type: 'integer' })
  companyId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company?: string;

  @Column({
    type: 'enum',
    enum: LeadStatus,
    default: LeadStatus.NEW,
  })
  status: LeadStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    answers?: Array<{ question: string; answer: string }>;
    [key: string]: any;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Appointment, (appointment) => appointment.lead)
  appointments: Appointment[];
}


