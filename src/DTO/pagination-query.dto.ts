import {
  IsOptional,
  IsNumber,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100 items per page' })
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'video analysis',
    description: 'Search query string',
  })
  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @Transform(({ value }: { value: any }): string | undefined =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @ApiPropertyOptional({
    example: 'created_at',
    description: 'Field to sort by',
    enum: ['created_at', 'updated_at'],
  })
  @IsOptional()
  @IsIn(['created_at', 'updated_at'], {
    message: 'Sort field must be either "created_at" or "updated_at"',
  })
  sortBy?: 'created_at' | 'updated_at' = 'created_at';

  @ApiPropertyOptional({
    example: 'desc',
    description: 'Sort order',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'Sort order must be either "asc" or "desc"',
  })
  sortOrder?: 'asc' | 'desc' = 'desc';
}
