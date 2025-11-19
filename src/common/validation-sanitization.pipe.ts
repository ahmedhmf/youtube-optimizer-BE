import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationAndSanitizationPipe implements PipeTransform {
  async transform(
    value: unknown,
    { metatype }: ArgumentMetadata,
  ): Promise<unknown> {
    // Skip validation for primitive types
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Sanitize the input
    const sanitizedValue = this.sanitizeInput(value);

    // Transform and validate
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const object = plainToClass(metatype, sanitizedValue);
    const errors = await validate(object as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const errorMessages = this.formatValidationErrors(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
        statusCode: 400,
      });
    }

    return object;
  }

  private toValidate(metatype: new (...args: unknown[]) => unknown): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype as never);
  }

  private sanitizeInput(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeInput(item));
    }

    if (typeof value === 'object' && value !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeInput(val);
      }
      return sanitized;
    }

    return value;
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    // Remove null bytes
    let sanitized = str.replace(/\0/g, '');

    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Basic HTML tag removal
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[<>'"]/g, '');

    // Basic SQL injection prevention
    const dangerousPatterns = [
      /union\s+select/gi,
      /drop\s+table/gi,
      /delete\s+from/gi,
      /insert\s+into/gi,
      /update\s+set/gi,
      /'.*or.*'/gi,
      /--/g,
      /\/\*/g,
      /\*\//g,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        console.warn('Potential SQL injection attempt detected:', sanitized);
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Trim whitespace
    return sanitized.trim();
  }

  private formatValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    errors.forEach((error) => {
      if (error.constraints) {
        const constraintMessages = Object.values(error.constraints);
        messages.push(...constraintMessages);
      }

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        const childErrors = this.formatValidationErrors(error.children);
        messages.push(...childErrors.map((msg) => `${error.property}.${msg}`));
      }
    });

    return messages;
  }
}

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly maxSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    maxSize: number = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes: string[] = [
      'text/plain',
      'application/json',
      'text/vtt', // Video Text Tracks
      'application/x-subrip', // SRT files
    ],
  ) {
    this.maxSize = maxSize;
    this.allowedMimeTypes = allowedMimeTypes;
  }

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Check file size
    if (file.size > this.maxSize) {
      throw new BadRequestException(
        `File size too large. Maximum size is ${this.maxSize / (1024 * 1024)}MB`,
      );
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }

    // Sanitize filename
    file.originalname = this.sanitizeFilename(file.originalname);

    // Scan file content for malicious patterns
    this.scanFileContent(file);

    return file;
  }

  private sanitizeFilename(filename: string): string {
    // Remove directory traversal attempts
    const sanitized = filename.replace(/[/\\.:*?"<>|]/g, '_');

    // Limit length
    return sanitized.substring(0, 255);
  }

  private scanFileContent(file: Express.Multer.File): void {
    if (!file.buffer) {
      return;
    }

    const content = file.buffer.toString('utf-8', 0, 1000); // Check first 1KB

    // Check for malicious patterns
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        throw new BadRequestException(
          'File contains potentially malicious content',
        );
      }
    }
  }
}
