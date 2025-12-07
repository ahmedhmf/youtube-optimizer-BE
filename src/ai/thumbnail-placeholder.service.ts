import { Injectable } from '@nestjs/common';
import { ThumbnailStyle } from './models/thumbnail.interface';
import { ThumbnailPlaceholder } from '../DTO/thumbnail-template.dto';

@Injectable()
export class ThumbnailPlaceholderService {
  /**
   * Generate placeholder positions based on template style
   * Coordinates are in percentages (0-100) for responsive positioning
   */
  static getPlaceholders(template: ThumbnailStyle): ThumbnailPlaceholder[] {
    switch (template) {
      case ThumbnailStyle.BIG_BOLD_TEXT:
        return [
          {
            type: 'text',
            id: 'main-title',
            x: 5,
            y: 35,
            width: 90,
            height: 30,
            zIndex: 2,
            metadata: {
              textAlign: 'center',
              fontSize: 'xlarge',
              fontWeight: 'black',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 2,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 85,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-right',
              opacity: 0.9,
            },
          },
        ];

      case ThumbnailStyle.FACE_LEFT_TEXT_RIGHT:
        return [
          {
            type: 'person',
            id: 'main-person',
            x: 5,
            y: 15,
            width: 40,
            height: 70,
            zIndex: 2,
            metadata: {
              shape: 'none',
              border: false,
            },
          },
          {
            type: 'text',
            id: 'main-title',
            x: 50,
            y: 30,
            width: 45,
            height: 40,
            zIndex: 2,
            metadata: {
              textAlign: 'left',
              fontSize: 'large',
              fontWeight: 'bold',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 3,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 85,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-right',
              opacity: 0.9,
            },
          },
        ];

      case ThumbnailStyle.DOCUMENTARY_STORY:
        return [
          {
            type: 'text',
            id: 'main-title',
            x: 10,
            y: 60,
            width: 80,
            height: 30,
            zIndex: 2,
            metadata: {
              textAlign: 'left',
              fontSize: 'large',
              fontWeight: 'bold',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 2,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 5,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-left',
              opacity: 0.8,
            },
          },
        ];

      case ThumbnailStyle.BEFORE_AFTER:
        return [
          {
            type: 'person',
            id: 'before-image',
            x: 5,
            y: 20,
            width: 40,
            height: 60,
            zIndex: 2,
            metadata: {
              shape: 'square',
              border: true,
            },
          },
          {
            type: 'person',
            id: 'after-image',
            x: 55,
            y: 20,
            width: 40,
            height: 60,
            zIndex: 2,
            metadata: {
              shape: 'square',
              border: true,
            },
          },
          {
            type: 'text',
            id: 'before-label',
            x: 5,
            y: 10,
            width: 40,
            height: 8,
            zIndex: 3,
            metadata: {
              textAlign: 'center',
              fontSize: 'medium',
              fontWeight: 'bold',
              color: '#FF0000',
              maxLines: 1,
            },
          },
          {
            type: 'text',
            id: 'after-label',
            x: 55,
            y: 10,
            width: 40,
            height: 8,
            zIndex: 3,
            metadata: {
              textAlign: 'center',
              fontSize: 'medium',
              fontWeight: 'bold',
              color: '#00FF00',
              maxLines: 1,
            },
          },
          {
            type: 'text',
            id: 'main-title',
            x: 10,
            y: 85,
            width: 80,
            height: 10,
            zIndex: 2,
            metadata: {
              textAlign: 'center',
              fontSize: 'large',
              fontWeight: 'black',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 1,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 85,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-right',
              opacity: 0.9,
            },
          },
        ];

      case ThumbnailStyle.CENTER_OBJECT_MINIMAL:
        return [
          {
            type: 'person',
            id: 'center-object',
            x: 30,
            y: 25,
            width: 40,
            height: 50,
            zIndex: 2,
            metadata: {
              shape: 'none',
              border: false,
            },
          },
          {
            type: 'text',
            id: 'main-title',
            x: 10,
            y: 80,
            width: 80,
            height: 15,
            zIndex: 2,
            metadata: {
              textAlign: 'center',
              fontSize: 'large',
              fontWeight: 'bold',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 2,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 85,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-right',
              opacity: 0.9,
            },
          },
        ];

      case ThumbnailStyle.NEON_TECH:
        return [
          {
            type: 'text',
            id: 'main-title',
            x: 10,
            y: 30,
            width: 80,
            height: 40,
            zIndex: 2,
            metadata: {
              textAlign: 'center',
              fontSize: 'xlarge',
              fontWeight: 'black',
              color: '#00FFFF',
              stroke: '#FF00FF',
              maxLines: 2,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 5,
            y: 85,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'bottom-left',
              opacity: 0.8,
            },
          },
        ];

      case ThumbnailStyle.REACTION_OBJECT:
        return [
          {
            type: 'person',
            id: 'reaction-face',
            x: 5,
            y: 10,
            width: 35,
            height: 35,
            zIndex: 3,
            metadata: {
              shape: 'circle',
              border: true,
            },
          },
          {
            type: 'person',
            id: 'main-object',
            x: 45,
            y: 15,
            width: 50,
            height: 60,
            zIndex: 2,
            metadata: {
              shape: 'none',
              border: false,
            },
          },
          {
            type: 'text',
            id: 'main-title',
            x: 5,
            y: 75,
            width: 90,
            height: 20,
            zIndex: 2,
            metadata: {
              textAlign: 'center',
              fontSize: 'large',
              fontWeight: 'black',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 2,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 85,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-right',
              opacity: 0.9,
            },
          },
        ];

      case ThumbnailStyle.TWO_TONE:
        return [
          {
            type: 'text',
            id: 'main-title',
            x: 10,
            y: 35,
            width: 80,
            height: 30,
            zIndex: 2,
            metadata: {
              textAlign: 'center',
              fontSize: 'xlarge',
              fontWeight: 'bold',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 2,
            },
          },
          {
            type: 'person',
            id: 'side-object',
            x: 70,
            y: 60,
            width: 25,
            height: 35,
            zIndex: 2,
            metadata: {
              shape: 'none',
              border: false,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 5,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-left',
              opacity: 0.9,
            },
          },
        ];

      case ThumbnailStyle.BLUR_BACKGROUND_TEXT:
        return [
          {
            type: 'text',
            id: 'main-title',
            x: 10,
            y: 40,
            width: 80,
            height: 20,
            zIndex: 2,
            metadata: {
              textAlign: 'center',
              fontSize: 'xlarge',
              fontWeight: 'black',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 1,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 85,
            y: 85,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'bottom-right',
              opacity: 0.7,
            },
          },
        ];

      case ThumbnailStyle.MAGAZINE_STYLE:
        return [
          {
            type: 'person',
            id: 'main-person',
            x: 10,
            y: 10,
            width: 50,
            height: 80,
            zIndex: 1,
            metadata: {
              shape: 'none',
              border: false,
            },
          },
          {
            type: 'text',
            id: 'main-title',
            x: 55,
            y: 20,
            width: 40,
            height: 30,
            zIndex: 2,
            metadata: {
              textAlign: 'left',
              fontSize: 'large',
              fontWeight: 'bold',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 3,
            },
          },
          {
            type: 'text',
            id: 'subtitle',
            x: 55,
            y: 55,
            width: 40,
            height: 15,
            zIndex: 2,
            metadata: {
              textAlign: 'left',
              fontSize: 'small',
              fontWeight: 'normal',
              color: '#CCCCCC',
              maxLines: 2,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 5,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-left',
              opacity: 0.9,
            },
          },
        ];

      default:
        return [
          {
            type: 'text',
            id: 'main-title',
            x: 10,
            y: 40,
            width: 80,
            height: 20,
            zIndex: 2,
            metadata: {
              textAlign: 'center',
              fontSize: 'large',
              fontWeight: 'bold',
              color: '#FFFFFF',
              stroke: '#000000',
              maxLines: 2,
            },
          },
          {
            type: 'logo',
            id: 'brand-logo',
            x: 85,
            y: 5,
            width: 10,
            height: 10,
            zIndex: 3,
            metadata: {
              position: 'top-right',
              opacity: 0.9,
            },
          },
        ];
    }
  }
}
