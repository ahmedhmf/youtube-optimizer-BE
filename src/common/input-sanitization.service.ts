import { Injectable } from '@nestjs/common';

export interface InputValidationService {
  sanitizeText(input: string): string;
  validateEmail(email: string): boolean;
  validatePassword(password: string): { isValid: boolean; errors: string[] };
  sanitizeFilename(filename: string): string;
}

@Injectable()
export class InputSanitizationService implements InputValidationService {
  /**
   * Sanitize text input by removing dangerous characters and patterns
   */
  sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove basic HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Remove script tags completely
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');

    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>"']/g, '');

    // Remove basic SQL injection patterns
    sanitized = sanitized.replace(/union\s+select/gi, '');
    sanitized = sanitized.replace(/drop\s+table/gi, '');
    sanitized = sanitized.replace(/delete\s+from/gi, '');
    sanitized = sanitized.replace(/insert\s+into/gi, '');

    // Remove path traversal attempts
    sanitized = sanitized.replace(/\.\.\//g, '');
    sanitized = sanitized.replace(/\\\.\.\\/g, '');

    return sanitized.trim();
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push(
        'Password must contain at least one special character (@$!%*?&)',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize filename for safe storage
   */
  sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed_file';
    }

    // Remove directory traversal
    let sanitized = filename.replace(/[/\\:*?"<>|]/g, '_');

    // Remove dots at the beginning
    sanitized = sanitized.replace(/^\.+/, '');

    // Limit length
    sanitized = sanitized.substring(0, 255);

    // Ensure we have a filename
    if (sanitized.length === 0) {
      return 'unnamed_file';
    }

    return sanitized;
  }

  /**
   * Check if input contains suspicious patterns
   */
  containsSuspiciousContent(input: string): boolean {
    const suspiciousPatterns = [
      // Basic XSS patterns
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,

      // Basic SQL injection patterns
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,

      // Path traversal
      /\.\.\//,
      /etc\/passwd/i,
      /windows\/system32/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Validate YouTube URL format
   */
  isValidYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/;
    return youtubeRegex.test(url);
  }

  /**
   * Validate name format (letters, spaces, hyphens, apostrophes only)
   */
  isValidName(name: string): boolean {
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    return nameRegex.test(name) && name.length >= 1 && name.length <= 100;
  }
}
