import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get('agent/:agentId')
  async findByAgent(@Param('agentId', ParseIntPipe) agentId: number, @CurrentUser() user: any) {
    return this.leadsService.findByAgent(agentId, user.userId, user.companyId);
  }
}

