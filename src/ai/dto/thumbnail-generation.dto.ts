import { ThumbnailStyle } from '../models/thumbnail.interface';

export interface ThumbnailAssetDto {
  // Common fields for all templates
  template: ThumbnailStyle;
  videoId: string;
  videoTitle: string;
  transcript: string;

  // Brand assets
  brandLogo?: {
    url: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size: 'small' | 'medium' | 'large';
  };
  watermark?: string;

  // Template-specific fields
  templateData: TemplateSpecificData;
}

export type TemplateSpecificData =
  | BigBoldTextData
  | FaceLeftTextRightData
  | DocumentaryStoryData
  | BeforeAfterData
  | CenterObjectMinimalData
  | NeonTechData
  | ReactionObjectData
  | TwoToneData
  | BlurBackgroundTextData
  | MagazineStyleData;

// BIG_BOLD_TEXT
export interface BigBoldTextData {
  type: 'big_bold_text';
  mainText: string;
  textColor: string;
  textOutlineColor: string;
  fontWeight: 'bold' | 'black';
  textShadow?: {
    color: string;
    intensity: number;
  };
}

// FACE_LEFT_TEXT_RIGHT
export interface FaceLeftTextRightData {
  type: 'face_left_text_right';
  personImageUrl: string; // User-uploaded image URL
  mainText: string;
  textColor: string;
  textBackgroundColor: string;
  textBackgroundOpacity: number;
  showArrow: boolean;
  personPosition?: 'left' | 'right';
}

// DOCUMENTARY_STORY
export interface DocumentaryStoryData {
  type: 'documentary_story';
  mainTitle: string;
  subtitle: string;
  titleColor: string;
  subtitleColor: string;
  overlayOpacity: number;
  mood: 'cinematic' | 'serious' | 'dramatic';
}

// BEFORE_AFTER
export interface BeforeAfterData {
  type: 'before_after';
  beforeImageUrl: string; // User-uploaded
  afterImageUrl: string; // User-uploaded
  beforeLabel: string;
  afterLabel: string;
  labelColor: string;
  labelBackgroundColor: string;
  dividerStyle: 'arrow' | 'line' | 'vs';
}

// CENTER_OBJECT_MINIMAL
export interface CenterObjectMinimalData {
  type: 'center_object_minimal';
  centerObjectUrl: string; // User-uploaded
  topText?: string;
  bottomText?: string;
  textColor: string;
  objectShadow: boolean;
  objectGlow?: {
    color: string;
    intensity: number;
  };
  backgroundBlur: number;
}

// NEON_TECH
export interface NeonTechData {
  type: 'neon_tech';
  mainText: string;
  neonColor: string;
  secondaryNeonColor: string;
  glowIntensity: number;
  showGrid: boolean;
  showScanlines: boolean;
}

// REACTION_OBJECT
export interface ReactionObjectData {
  type: 'reaction_object';
  personImageUrl: string; // User-uploaded
  objectImageUrl: string; // User-uploaded
  mainText?: string;
  personPosition: 'left' | 'right';
  emotion: 'surprised' | 'shocked' | 'excited' | 'happy';
  showConnector: boolean;
}

// TWO_TONE
export interface TwoToneData {
  type: 'two_tone';
  leftColor: string;
  rightColor: string;
  mainText: string;
  textColor: string;
  textOutlineColor: string;
  dividerStyle: 'hard' | 'gradient' | 'diagonal';
}

// BLUR_BACKGROUND_TEXT
export interface BlurBackgroundTextData {
  type: 'blur_background_text';
  mainText: string;
  textColor: string;
  textStyle: 'clean' | 'outlined';
  blurIntensity: number;
  showTextBox: boolean;
  textBoxColor?: string;
  textBoxOpacity?: number;
}

// MAGAZINE_STYLE
export interface MagazineStyleData {
  type: 'magazine_style';
  mainHeadline: string;
  subtitle: string;
  accentColor: string;
  coverImageUrl?: string; // User-uploaded (optional)
  headlineColor: string;
  subtitleColor: string;
  logoUrl?: string;
  layoutStyle: 'traditional' | 'modern' | 'bold';
}
