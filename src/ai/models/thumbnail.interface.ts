export interface ThumbnailTextStyle {
  text: string;
  fontSize: number;
  fontWeight: 'bold' | 'normal' | 'black';
  fontFamily: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  position: 'top' | 'bottom' | 'center';
  align: 'left' | 'center' | 'right';
  maxWidth: number;
  padding: number;
}

export interface ThumbnailTemplate {
  name: string;
  description: string;
  textStyle: ThumbnailTextStyle;
  backgroundColor?: string;
  overlayOpacity?: number;
}

export enum ThumbnailStyle {
  BIG_BOLD_TEXT = 'big_bold_text',
  FACE_LEFT_TEXT_RIGHT = 'face_left_text_right',
  DOCUMENTARY_STORY = 'documentary_story',
  BEFORE_AFTER = 'before_after',
  CENTER_OBJECT_MINIMAL = 'center_object_minimal',
  NEON_TECH = 'neon_tech',
  REACTION_OBJECT = 'reaction_object',
  TWO_TONE = 'two_tone',
  BLUR_BACKGROUND_TEXT = 'blur_background_text',
  MAGAZINE_STYLE = 'magazine_style',
}
