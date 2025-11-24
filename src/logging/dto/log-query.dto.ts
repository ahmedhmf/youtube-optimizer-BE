import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  LogType,
  LogSeverity,
  ErrorType,
  SystemLogCategory,
  VideoAnalysisStatus,
} from './log.types';

export class LogQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ enum: LogType, required: false })
  @IsOptional()
  @IsEnum(LogType)
  logType?: LogType;

  @ApiProperty({ enum: LogSeverity, required: false })
  @IsOptional()
  @IsEnum(LogSeverity)
  severity?: LogSeverity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class ErrorLogQueryDto extends LogQueryDto {
  @ApiProperty({ enum: ErrorType, required: false })
  @IsOptional()
  @IsEnum(ErrorType)
  errorType?: ErrorType;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Boolean)
  resolved?: boolean;
}

export class SystemLogQueryDto extends LogQueryDto {
  @ApiProperty({ enum: SystemLogCategory, required: false })
  @IsOptional()
  @IsEnum(SystemLogCategory)
  category?: SystemLogCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  serviceName?: string;
}

export class VideoAnalysisLogQueryDto extends LogQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  videoId?: string;

  @ApiProperty({ enum: VideoAnalysisStatus, required: false })
  @IsOptional()
  @IsEnum(VideoAnalysisStatus)
  status?: VideoAnalysisStatus;
}

export class ApiLogQueryDto extends LogQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;
}

export class SearchLogsDto {
  @ApiProperty()
  @IsString()
  searchTerm: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ResolveErrorDto {
  @ApiProperty()
  @IsString()
  resolutionNotes: string;
}
