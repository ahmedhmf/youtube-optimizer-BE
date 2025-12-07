import { ApiProperty } from '@nestjs/swagger';

export interface ThumbnailPlaceholder {
  type: 'text' | 'person' | 'logo';
  id: string;
  x: number; // Position X (percentage 0-100)
  y: number; // Position Y (percentage 0-100)
  width: number; // Width (percentage 0-100)
  height: number; // Height (percentage 0-100)
  zIndex: number; // Layering order
  metadata?: {
    // For text placeholders
    textAlign?: 'left' | 'center' | 'right';
    fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
    fontWeight?: 'normal' | 'bold' | 'black';
    color?: string;
    stroke?: string;
    maxLines?: number;
    
    // For person placeholders
    shape?: 'circle' | 'square' | 'none';
    border?: boolean;
    
    // For logo placeholders
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity?: number;
  };
}

export class ThumbnailTemplateResponseDto {
  @ApiProperty({
    description: 'Public URL of the enhanced background image',
    example: 'https://storage.supabase.co/thumbnails/abc123.png',
  })
  backgroundUrl: string;

  @ApiProperty({
    description: 'Selected template style',
    example: 'BIG_BOLD_TEXT',
  })
  template: string;

  @ApiProperty({
    description: 'Enhancement style applied',
    example: 'cinematic',
  })
  enhancementStyle: string;

  @ApiProperty({
    description: 'Placeholder positions for text, person images, and logos',
    type: 'array',
  })
  placeholders: ThumbnailPlaceholder[];

  @ApiProperty({
    description: 'Timestamp when thumbnail was generated',
    example: '2025-12-05T10:30:00Z',
  })
  generatedAt: string;

  @ApiProperty({
    description: 'Background dimensions',
    example: { width: 1792, height: 1024 },
  })
  dimensions: {
    width: number;
    height: number;
  };
}
