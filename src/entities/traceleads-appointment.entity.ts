import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('appointments')
export class TraceLeadsAppointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lead_id', type: 'int', nullable: true })
  leadId: number | null;

  @Column({ name: 'lead_cnpj', type: 'varchar', length: 14, nullable: true })
  leadCnpj: string | null;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'attendee_name', type: 'varchar', length: 255 })
  attendeeName: string;

  @Column({ name: 'attendee_email', type: 'varchar', length: 255 })
  attendeeEmail: string;

  @Column({ name: 'attendee_phone', type: 'varchar', length: 50, nullable: true })
  attendeePhone: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamp' })
  scheduledAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @Column({ name: 'confirmation_token', type: 'varchar', length: 255, nullable: true })
  confirmationToken: string | null;

  @Column({ name: 'google_event_id', type: 'varchar', length: 255, nullable: true })
  googleEventId: string | null;

  @Column({ name: 'synced_with_google', type: 'boolean', default: false })
  syncedWithGoogle: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'google_meet_link', type: 'text', nullable: true })
  googleMeetLink: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

