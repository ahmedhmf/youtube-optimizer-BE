import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { ThumbnailStyle } from './models/thumbnail.interface';

@Injectable()
export class ThumbnailAssetsComposerService {
  private readonly logger = new Logger(ThumbnailAssetsComposerService.name);

  /**
   * Compose complete thumbnail by layering user-provided images and text over AI background
   */
  async composeWithAssets(
    backgroundBuffer: Buffer,
    template: string,
    templateData: Record<string, any>,
    brandLogo?: {
      url: string;
      position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      size: 'small' | 'medium' | 'large';
    },
    watermark?: string,
  ): Promise<Buffer> {
    const WIDTH = 1280;
    const HEIGHT = 720;

    try {
      this.logger.log(`Composing thumbnail with template: ${template}`);
      this.logger.log(`Template data received: ${JSON.stringify(templateData)}`);

      if (!templateData || typeof templateData !== 'object') {
        throw new Error('Invalid template data provided');
      }

      // If config is nested, extract it to the top level
      const actualData = templateData.config || templateData;
      this.logger.log(`Using template data: ${JSON.stringify(actualData)}`);

      let composite = sharp(backgroundBuffer).resize(WIDTH, HEIGHT);

      // Apply template-specific composition
      switch (template) {
        case ThumbnailStyle.BIG_BOLD_TEXT:
          if (!actualData.mainText) {
            throw new Error(
              `mainText is required for BIG_BOLD_TEXT template. Expected: { mainText: string, textColor: string, textOutlineColor: string }. Received: ${JSON.stringify(actualData)}`,
            );
          }
          composite = await this.composeBigBoldText(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.FACE_LEFT_TEXT_RIGHT:
          composite = await this.composeFaceLeftTextRight(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.DOCUMENTARY_STORY:
          composite = await this.composeDocumentaryStory(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.BEFORE_AFTER:
          composite = await this.composeBeforeAfter(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.CENTER_OBJECT_MINIMAL:
          composite = await this.composeCenterObjectMinimal(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.NEON_TECH:
          composite = await this.composeNeonTech(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.REACTION_OBJECT:
          composite = await this.composeReactionObject(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.TWO_TONE:
          composite = await this.composeTwoTone(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.BLUR_BACKGROUND_TEXT:
          composite = await this.composeBlurBackgroundText(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        case ThumbnailStyle.MAGAZINE_STYLE:
          composite = await this.composeMagazineStyle(
            composite,
            actualData,
            WIDTH,
            HEIGHT,
          );
          break;
        default:
          this.logger.warn(`Unknown template: ${template}, using default`);
      }

      // Add brand logo if provided
      if (brandLogo) {
        composite = await this.addBrandLogo(
          composite,
          brandLogo,
          WIDTH,
          HEIGHT,
        );
      }

      // Add watermark if provided
      if (watermark) {
        composite = await this.addWatermark(composite, watermark, WIDTH, HEIGHT);
      }

      return await composite.png({ quality: 100 }).toBuffer();
    } catch (error) {
      this.logger.error('Failed to compose thumbnail with assets:', error);
      throw error;
    }
  }

  private async composeBigBoldText(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    // Normalize intensity from 0-100 to 0-1 if needed
    const shadowIntensity = data.textShadow?.intensity
      ? data.textShadow.intensity > 1
        ? data.textShadow.intensity / 100
        : data.textShadow.intensity
      : 0.5;

    const svg = `
      <svg width="${width}" height="${height}">
        <defs>
          <filter id="shadow">
            <feDropShadow dx="4" dy="4" stdDeviation="3" flood-opacity="${shadowIntensity}" flood-color="${data.textShadow?.color || '#000000'}"/>
          </filter>
        </defs>
        <text
          x="50%"
          y="50%"
          font-family="Arial Black, sans-serif"
          font-size="120"
          font-weight="${data.fontWeight || 'bold'}"
          fill="${data.textColor}"
          stroke="${data.textOutlineColor}"
          stroke-width="8"
          text-anchor="middle"
          dominant-baseline="middle"
          filter="url(#shadow)"
        >
          ${this.escapeXml(data.mainText)}
        </text>
      </svg>
    `;

    return image.composite([
      { input: Buffer.from(svg), blend: 'over', top: 0, left: 0 },
    ]);
  }

  private async composeFaceLeftTextRight(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const overlays: sharp.OverlayOptions[] = [];

    // Download and add person image
    if (data.personImageUrl) {
      const personImage = await this.downloadImage(data.personImageUrl);
      const personBuffer = await sharp(personImage)
        .resize(Math.floor(width * 0.4), Math.floor(height * 0.9), {
          fit: 'cover',
        })
        .toBuffer();

      overlays.push({
        input: personBuffer,
        top: Math.floor(height * 0.05),
        left: data.personPosition === 'right' ? Math.floor(width * 0.55) : 50,
      });
    }

    // Add text with background
    const textX = data.personPosition === 'right' ? '25%' : '75%';
    const svg = `
      <svg width="${width}" height="${height}">
        <rect
          x="${data.personPosition === 'right' ? '5%' : '55%'}"
          y="25%"
          width="40%"
          height="50%"
          fill="${data.textBackgroundColor}"
          opacity="${data.textBackgroundOpacity}"
          rx="20"
        />
        <text
          x="${textX}"
          y="50%"
          font-family="Arial, sans-serif"
          font-size="60"
          font-weight="bold"
          fill="${data.textColor}"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          ${this.wrapText(data.mainText, 20)}
        </text>
      </svg>
    `;

    overlays.push({ input: Buffer.from(svg), blend: 'over', top: 0, left: 0 });

    return image.composite(overlays);
  }

  private async composeDocumentaryStory(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const svg = `
      <svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="#000000" opacity="${data.overlayOpacity || 0.3}"/>
        <text
          x="50%"
          y="30%"
          font-family="Georgia, serif"
          font-size="80"
          font-weight="bold"
          fill="${data.titleColor}"
          text-anchor="middle"
        >
          ${this.escapeXml(data.mainTitle)}
        </text>
        <text
          x="50%"
          y="70%"
          font-family="Georgia, serif"
          font-size="40"
          fill="${data.subtitleColor}"
          text-anchor="middle"
        >
          ${this.escapeXml(data.subtitle)}
        </text>
      </svg>
    `;

    return image.composite([
      { input: Buffer.from(svg), blend: 'over', top: 0, left: 0 },
    ]);
  }

  private async composeBeforeAfter(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const overlays: sharp.OverlayOptions[] = [];

    // Download and add before image
    // Handle both beforeImage (frontend) and beforeImageUrl (backend) property names
    const beforeImageUrl = data.beforeImage || data.beforeImageUrl;
    if (beforeImageUrl) {
      const beforeImage = await this.downloadImage(beforeImageUrl);
      const beforeBuffer = await sharp(beforeImage)
        .resize(Math.floor(width * 0.45), Math.floor(height * 0.8), {
          fit: 'cover',
        })
        .toBuffer();

      overlays.push({
        input: beforeBuffer,
        top: Math.floor(height * 0.1),
        left: Math.floor(width * 0.025),
      });
    }

    // Download and add after image
    // Handle both afterImage (frontend) and afterImageUrl (backend) property names
    const afterImageUrl = data.afterImage || data.afterImageUrl;
    if (afterImageUrl) {
      const afterImage = await this.downloadImage(afterImageUrl);
      const afterBuffer = await sharp(afterImage)
        .resize(Math.floor(width * 0.45), Math.floor(height * 0.8), {
          fit: 'cover',
        })
        .toBuffer();

      overlays.push({
        input: afterBuffer,
        top: Math.floor(height * 0.1),
        left: Math.floor(width * 0.525),
      });
    }

    // Add labels
    // Handle frontend sending label as object with text and color properties
    const beforeLabelText = typeof data.beforeLabel === 'object' ? data.beforeLabel.text : data.beforeLabel;
    const afterLabelText = typeof data.afterLabel === 'object' ? data.afterLabel.text : data.afterLabel;
    const beforeLabelColor = typeof data.beforeLabel === 'object' && data.beforeLabel.color ? data.beforeLabel.color : (data.labelColor || '#FFFFFF');
    const afterLabelColor = typeof data.afterLabel === 'object' && data.afterLabel.color ? data.afterLabel.color : (data.labelColor || '#FFFFFF');
    const labelBg = data.labelBackground || data.labelBackgroundColor || 'rgba(0, 0, 0, 0.8)';
    
    const svg = `
      <svg width="${width}" height="${height}">
        <rect x="${width * 0.025}" y="${height * 0.85}" width="${width * 0.2}" height="60" fill="${labelBg}" rx="10"/>
        <text x="${width * 0.125}" y="${height * 0.9}" font-size="40" font-weight="bold" fill="${beforeLabelColor}" text-anchor="middle">${this.escapeXml(beforeLabelText)}</text>
        
        <rect x="${width * 0.775}" y="${height * 0.85}" width="${width * 0.2}" height="60" fill="${labelBg}" rx="10"/>
        <text x="${width * 0.875}" y="${height * 0.9}" font-size="40" font-weight="bold" fill="${afterLabelColor}" text-anchor="middle">${this.escapeXml(afterLabelText)}</text>
        
        ${this.getDividerSvg(data.dividerStyle, width, height)}
      </svg>
    `;

    overlays.push({ input: Buffer.from(svg), blend: 'over', top: 0, left: 0 });

    return image.composite(overlays);
  }

  private async composeCenterObjectMinimal(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const overlays: sharp.OverlayOptions[] = [];

    // Download and add center object
    if (data.centerObjectUrl) {
      const objectImage = await this.downloadImage(data.centerObjectUrl);
      const objectBuffer = await sharp(objectImage)
        .resize(Math.floor(width * 0.5), Math.floor(height * 0.6), {
          fit: 'inside',
        })
        .toBuffer();

      overlays.push({
        input: objectBuffer,
        top: Math.floor(height * 0.2),
        left: Math.floor(width * 0.25),
      });
    }

    // Add optional text
    if (data.topText || data.bottomText) {
      const svg = `
        <svg width="${width}" height="${height}">
          ${data.topText ? `<text x="50%" y="10%" font-size="50" font-weight="bold" fill="${data.textColor}" text-anchor="middle">${this.escapeXml(data.topText)}</text>` : ''}
          ${data.bottomText ? `<text x="50%" y="90%" font-size="50" font-weight="bold" fill="${data.textColor}" text-anchor="middle">${this.escapeXml(data.bottomText)}</text>` : ''}
        </svg>
      `;
      overlays.push({
        input: Buffer.from(svg),
        blend: 'over',
        top: 0,
        left: 0,
      });
    }

    return image.composite(overlays);
  }

  private async composeNeonTech(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const svg = `
      <svg width="${width}" height="${height}">
        <defs>
          <filter id="neon-glow">
            <feGaussianBlur stdDeviation="${data.glowIntensity || 10}" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        ${data.showGrid ? this.getGridPattern(width, height) : ''}
        ${data.showScanlines ? this.getScanlinesPattern(width, height) : ''}
        <text
          x="50%"
          y="50%"
          font-family="'Orbitron', monospace"
          font-size="90"
          font-weight="bold"
          fill="${data.neonColor}"
          stroke="${data.secondaryNeonColor}"
          stroke-width="2"
          text-anchor="middle"
          dominant-baseline="middle"
          filter="url(#neon-glow)"
        >
          ${this.escapeXml(data.mainText)}
        </text>
      </svg>
    `;

    return image.composite([
      { input: Buffer.from(svg), blend: 'over', top: 0, left: 0 },
    ]);
  }

  private async composeReactionObject(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const overlays: sharp.OverlayOptions[] = [];

    // Add person image
    if (data.personImageUrl) {
      const personImage = await this.downloadImage(data.personImageUrl);
      const personBuffer = await sharp(personImage)
        .resize(Math.floor(width * 0.35), Math.floor(height * 0.7), {
          fit: 'cover',
        })
        .toBuffer();

      overlays.push({
        input: personBuffer,
        top: Math.floor(height * 0.15),
        left:
          data.personPosition === 'left'
            ? Math.floor(width * 0.05)
            : Math.floor(width * 0.6),
      });
    }

    // Add object image
    if (data.objectImageUrl) {
      const objectImage = await this.downloadImage(data.objectImageUrl);
      const objectBuffer = await sharp(objectImage)
        .resize(Math.floor(width * 0.35), Math.floor(height * 0.6), {
          fit: 'contain',
        })
        .toBuffer();

      overlays.push({
        input: objectBuffer,
        top: Math.floor(height * 0.2),
        left:
          data.personPosition === 'left'
            ? Math.floor(width * 0.6)
            : Math.floor(width * 0.05),
      });
    }

    return image.composite(overlays);
  }

  private async composeTwoTone(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const svg = `
      <svg width="${width}" height="${height}">
        ${this.getTwoToneBackground(data, width, height)}
        <text
          x="50%"
          y="50%"
          font-family="Arial Black, sans-serif"
          font-size="100"
          font-weight="bold"
          fill="${data.textColor}"
          stroke="${data.textOutlineColor}"
          stroke-width="6"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          ${this.escapeXml(data.mainText)}
        </text>
      </svg>
    `;

    return image.composite([
      { input: Buffer.from(svg), blend: 'over', top: 0, left: 0 },
    ]);
  }

  private async composeBlurBackgroundText(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    // Apply blur to background
    image = image.blur(data.blurIntensity || 5);

    const svg = `
      <svg width="${width}" height="${height}">
        ${data.showTextBox ? `<rect x="20%" y="35%" width="60%" height="30%" fill="${data.textBoxColor || '#000000'}" opacity="${data.textBoxOpacity || 0.5}" rx="20"/>` : ''}
        <text
          x="50%"
          y="50%"
          font-family="Arial, sans-serif"
          font-size="90"
          font-weight="bold"
          fill="${data.textColor}"
          ${data.textStyle === 'outlined' ? `stroke="#000000" stroke-width="3"` : ''}
          text-anchor="middle"
          dominant-baseline="middle"
        >
          ${this.escapeXml(data.mainText)}
        </text>
      </svg>
    `;

    return image.composite([
      { input: Buffer.from(svg), blend: 'over', top: 0, left: 0 },
    ]);
  }

  private async composeMagazineStyle(
    image: sharp.Sharp,
    data: any,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const overlays: sharp.OverlayOptions[] = [];

    // Add cover image if provided
    if (data.coverImageUrl) {
      const coverImage = await this.downloadImage(data.coverImageUrl);
      const coverBuffer = await sharp(coverImage)
        .resize(Math.floor(width * 0.4), Math.floor(height * 0.6), {
          fit: 'cover',
        })
        .toBuffer();

      overlays.push({
        input: coverBuffer,
        top: Math.floor(height * 0.2),
        left: Math.floor(width * 0.55),
      });
    }

    // Add text
    const svg = `
      <svg width="${width}" height="${height}">
        <text
          x="5%"
          y="30%"
          font-family="'Playfair Display', Georgia, serif"
          font-size="70"
          font-weight="bold"
          fill="${data.headlineColor}"
        >
          ${this.wrapText(data.mainHeadline, 30)}
        </text>
        <text
          x="5%"
          y="50%"
          font-family="Arial, sans-serif"
          font-size="35"
          fill="${data.subtitleColor}"
        >
          ${this.escapeXml(data.subtitle)}
        </text>
        <rect x="5%" y="55%" width="100" height="5" fill="${data.accentColor}"/>
      </svg>
    `;

    overlays.push({ input: Buffer.from(svg), blend: 'over', top: 0, left: 0 });

    return image.composite(overlays);
  }

  private async addBrandLogo(
    image: sharp.Sharp,
    logo: {
      url: string;
      position: string;
      size: string;
    },
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    try {
      const logoImage = await this.downloadImage(logo.url);
      const logoSize =
        logo.size === 'large' ? 150 : logo.size === 'medium' ? 100 : 60;

      const logoBuffer = await sharp(logoImage)
        .resize(logoSize, logoSize, { fit: 'inside' })
        .toBuffer();

      const positions = {
        'top-left': { top: 20, left: 20 },
        'top-right': { top: 20, left: width - logoSize - 20 },
        'bottom-left': { top: height - logoSize - 20, left: 20 },
        'bottom-right': {
          top: height - logoSize - 20,
          left: width - logoSize - 20,
        },
      };

      const pos = positions[logo.position] || positions['top-right'];

      return image.composite([{ input: logoBuffer, ...pos }]);
    } catch (error) {
      this.logger.warn('Failed to add brand logo:', error);
      return image;
    }
  }

  private async addWatermark(
    image: sharp.Sharp,
    watermark: string,
    width: number,
    height: number,
  ): Promise<sharp.Sharp> {
    const svg = `
      <svg width="${width}" height="${height}">
        <text
          x="${width - 10}"
          y="${height - 10}"
          font-family="Arial, sans-serif"
          font-size="20"
          fill="#FFFFFF"
          opacity="0.5"
          text-anchor="end"
        >
          ${this.escapeXml(watermark)}
        </text>
      </svg>
    `;

    return image.composite([
      { input: Buffer.from(svg), blend: 'over', top: 0, left: 0 },
    ]);
  }

  // Helper methods
  private async downloadImage(url: string): Promise<Buffer> {
    // Check if it's a base64 data URL
    if (url.startsWith('data:')) {
      const base64Data = url.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    }
    
    // Otherwise, fetch from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image from ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private escapeXml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private wrapText(text: string, maxLength: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length > maxLength) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    if (currentLine) lines.push(currentLine.trim());

    return lines.map((line, i) => `<tspan x="50%" dy="${i === 0 ? 0 : '1.2em'}">${this.escapeXml(line)}</tspan>`).join('');
  }

  private getDividerSvg(
    style: string,
    width: number,
    height: number,
  ): string {
    const centerX = width / 2;
    const centerY = height / 2;

    switch (style) {
      case 'arrow':
        return `<polygon points="${centerX - 30},${centerY} ${centerX + 30},${centerY - 30} ${centerX + 30},${centerY + 30}" fill="#FFFFFF" stroke="#000000" stroke-width="3"/>`;
      case 'vs':
        return `<text x="${centerX}" y="${centerY}" font-size="80" font-weight="bold" fill="#FFFFFF" stroke="#000000" stroke-width="3" text-anchor="middle" dominant-baseline="middle">VS</text>`;
      default:
        return `<line x1="${centerX}" y1="${height * 0.1}" x2="${centerX}" y2="${height * 0.9}" stroke="#FFFFFF" stroke-width="5"/>`;
    }
  }

  private getTwoToneBackground(
    data: any,
    width: number,
    height: number,
  ): string {
    switch (data.dividerStyle) {
      case 'gradient':
        return `
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:${data.leftColor};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${data.rightColor};stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#gradient)"/>
        `;
      case 'diagonal':
        return `
          <polygon points="0,0 ${width},0 0,${height}" fill="${data.leftColor}"/>
          <polygon points="${width},0 ${width},${height} 0,${height}" fill="${data.rightColor}"/>
        `;
      default:
        return `
          <rect x="0" y="0" width="${width / 2}" height="${height}" fill="${data.leftColor}"/>
          <rect x="${width / 2}" y="0" width="${width / 2}" height="${height}" fill="${data.rightColor}"/>
        `;
    }
  }

  private getGridPattern(width: number, height: number): string {
    return `<pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#00FFFF" stroke-width="0.5" opacity="0.3"/></pattern><rect width="${width}" height="${height}" fill="url(#grid)"/>`;
  }

  private getScanlinesPattern(width: number, height: number): string {
    return `<pattern id="scanlines" width="100%" height="4" patternUnits="userSpaceOnUse"><rect width="100%" height="2" fill="#000000" opacity="0.1"/></pattern><rect width="${width}" height="${height}" fill="url(#scanlines)"/>`;
  }
}
