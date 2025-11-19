import {
  IsOptional,
  IsNumber,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: any }): string | undefined =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @IsOptional()
  @IsIn(['created_at', 'updated_at'])
  sortBy?: 'created_at' | 'updated_at' = 'created_at';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
