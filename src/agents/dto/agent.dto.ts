import { IsString, IsOptional, IsBoolean, IsObject, IsArray } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  fsmConfig: any;

  @IsObject()
  @IsOptional()
  behaviorConfig?: any;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  headerColor?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsObject()
  @IsOptional()
  fsmConfig?: any;

  @IsObject()
  @IsOptional()
  behaviorConfig?: any;
}

export class CreateDefaultAgentDto {
  @IsString()
  companyName: string;
}

export class UpdateAvailabilityDto {
  @IsObject()
  @IsOptional()
  calendarConfig?: {
    workingHours: { start: number; end: number };
    workingDays: number[];
    slotDuration: number;
  };

  @IsObject()
  @IsOptional()
  availabilityByDay?: Record<string, { start: string; end: string }>; // { "Segunda-feira": { start: "08:00", end: "12:00" }, ... }
  
  @IsObject()
  @IsOptional()
  availabilityByDateRange?: {
    startDate: string; // "2024-01-01"
    endDate: string; // "2024-01-31"
    startTime: string; // "08:00"
    endTime: string; // "18:00"
    daysOfWeek?: number[]; // [1, 2, 3, 4, 5] - opcional, filtra apenas esses dias da semana
  };
  
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludedSlots?: string[]; // ["Segunda-feira 09:30", "Terça-feira 14:00", ...]
}

