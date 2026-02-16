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
import { User } from './user.entity';
import { Conversation } from './conversation.entity';
import { Lead } from './lead.entity';
import { Appointment } from './appointment.entity';

@Entity('ia_agents')
@Index(['userId'])
@Index(['companyId'])
@Index(['isActive'])
export class Agent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @ManyToOne(() => User, (user) => user.agents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'company_id', type: 'integer' })
  companyId: number;

  @Column({ name: 'widget_token', type: 'varchar', length: 255, nullable: true, unique: true })
  @Index(['widgetToken'])
  widgetToken?: string;

  @Column({ name: 'header_color', type: 'varchar', length: 50, nullable: true, default: '#1e3a5f' })
  headerColor?: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl?: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'fsm_config', type: 'jsonb' })
  fsmConfig: {
    initialState: string;
    states: Array<{
      id: string;
      name: string;
      type: string;
      handlerClass: string;
    }>;
    transitions: Record<string, string>;
  };

  @Column({ name: 'behavior_config', type: 'jsonb', nullable: true })
  behaviorConfig?: {
    companyName?: string;
    strategicQuestions?: string[];
    calendarConfig?: {
      workingHours: { start: number; end: number };
      workingDays: number[];
      slotDuration: number;
    };
    availableSlots?: string[];
    excludedSlots?: string[];
    enableCalendar?: boolean;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Conversation, (conversation) => conversation.agent)
  conversations: Conversation[];

  @OneToMany(() => Lead, (lead) => lead.agent)
  leads: Lead[];

  @OneToMany(() => Appointment, (appointment) => appointment.agent)
  appointments: Appointment[];
}

