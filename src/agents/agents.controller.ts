import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto, CreateDefaultAgentDto, UpdateAvailabilityDto } from './dto/agent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.agentsService.findAll(user.userId, user.companyId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.agentsService.findOne(id, user.userId, user.companyId);
  }

  @Post()
  async create(@Body() createAgentDto: CreateAgentDto, @CurrentUser() user: any) {
    return this.agentsService.create(user.userId, user.companyId, createAgentDto);
  }

  @Post('create-default')
  async createDefault(@Body() createDefaultDto: CreateDefaultAgentDto, @CurrentUser() user: any) {
    return this.agentsService.createDefault(user.userId, user.companyId, createDefaultDto.companyName);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAgentDto: UpdateAgentDto,
    @CurrentUser() user: any,
  ) {
    await this.agentsService.update(id, user.userId, user.companyId, updateAgentDto);
    return { success: true };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    await this.agentsService.remove(id, user.userId, user.companyId);
    return { success: true };
  }

  @Put(':id/availability')
  async updateAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAvailabilityDto: UpdateAvailabilityDto,
    @CurrentUser() user: any,
  ) {
    await this.agentsService.updateAvailability(id, user.userId, user.companyId, updateAvailabilityDto);
    return { success: true };
  }
}
