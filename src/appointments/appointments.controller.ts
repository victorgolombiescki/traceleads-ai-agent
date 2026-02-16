import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.appointmentsService.findAll(user.userId, user.companyId);
  }

  @Get('agent/:agentId')
  async findByAgent(@Param('agentId', ParseIntPipe) agentId: number, @CurrentUser() user: any) {
    return this.appointmentsService.findByAgent(agentId, user.userId, user.companyId);
  }
}

