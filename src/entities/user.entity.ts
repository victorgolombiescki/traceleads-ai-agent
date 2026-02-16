import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
  } from 'typeorm';
  
  @Entity('ia_users')
  @Index(['openId'], { unique: true })
  @Index(['companyId'])
  export class User {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ name: 'open_id', type: 'varchar', length: 255, unique: true })
    openId: string;
  
    @Column({ type: 'text', nullable: true })
    name: string | null;
  
    @Column({ type: 'text', nullable: true })
    email: string | null;
  
    @Column({ name: 'login_method', type: 'text', nullable: true })
    loginMethod: string | null;
  
    @Column({ type: 'text', default: 'user' })
    role: string;
  
    @Column({ name: 'company_id', type: 'integer', nullable: true })
    companyId: number | null;
  
    @Column({ name: 'last_signed_in', type: 'timestamp', nullable: true })
    lastSignedIn: Date | null;
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
  
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
  
    @OneToMany('Agent', 'user')
    agents: any[];
  }
  