import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sdk } from '../core/sdk';
import { User } from '../entities/user.entity';
// Using process.env directly
import type { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async authenticateRequest(req: Request): Promise<User | null> {
    try {
      const user = await sdk.authenticateRequest(req);
      return user;
    } catch (error) {
      return null;
    }
  }

  async getUserByOpenId(openId: string): Promise<User | undefined> {
    return this.userRepository.findOne({
      where: { openId },
    });
  }

  async upsertUser(userData: {
    openId: string;
    name?: string | null;
    email?: string | null;
    loginMethod?: string | null;
    lastSignedIn?: Date;
    role?: string;
    companyId?: number;
  }): Promise<void> {
    if (!userData.openId) {
      throw new Error('User openId is required for upsert');
    }

    const existingUser = await this.userRepository.findOne({
      where: { openId: userData.openId },
    });

    const updateData: Partial<User> = {
      openId: userData.openId,
      name: userData.name ?? null,
      email: userData.email ?? null,
      loginMethod: userData.loginMethod ?? null,
      lastSignedIn: userData.lastSignedIn ?? new Date(),
      role: userData.role || (userData.openId === process.env.OWNER_OPEN_ID ? 'admin' : 'user'),
      companyId: userData.companyId ?? null,
    };

    if (existingUser) {
      await this.userRepository.update({ id: existingUser.id }, updateData);
    } else {
      await this.userRepository.save(this.userRepository.create(updateData));
    }
  }
}

