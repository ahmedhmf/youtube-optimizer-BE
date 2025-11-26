import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter<SMTPTransport.SentMessageInfo>;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    // Only initialize if SMTP credentials are configured
    if (emailConfig.auth.user && emailConfig.auth.pass) {
      this.transporter = nodemailer.createTransport(emailConfig);
      this.logger.log('Email transporter initialized successfully');
    } else {
      this.logger.warn(
        'Email service not configured - SMTP credentials missing. Emails will be logged to console.',
      );
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.logger.warn(
          `[EMAIL NOT SENT - No transporter configured]\nTo: ${options.to}\nSubject: ${options.subject}\n`,
        );
        return false;
      }

      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'YouTube Optimizer'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to ${options.to}: ${info.messageId}`,
      );
      return true;
    } catch (error) {
      // Log as warning instead of error since this doesn't affect app functionality
      this.logger.warn(
        `Email delivery failed to ${options.to}. This is expected if SMTP is not configured or network blocks SMTP connections. The user registration/operation was still successful.`,
      );
      // Only log full error details in debug mode
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Email error details:`, error);
      }
      return false;
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    console.log('Sending welcome email to:', email, 'Name:', name);
    const subject = 'Welcome to YouTube Optimizer!';
    const html = this.getWelcomeEmailTemplate(name);
    const text = this.getWelcomeEmailText(name);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password?token=${resetToken}`;
    const subject = 'Reset Your Password - YouTube Optimizer';
    const html = this.getPasswordResetEmailTemplate(name, resetUrl);
    const text = this.getPasswordResetEmailText(name, resetUrl);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendPasswordChangedEmail(
    email: string,
    name: string,
  ): Promise<boolean> {
    const subject = 'Your Password Has Been Changed - YouTube Optimizer';
    const html = this.getPasswordChangedEmailTemplate(name);
    const text = this.getPasswordChangedEmailText(name);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendEmailVerificationEmail(
    email: string,
    name: string,
    verificationToken: string,
  ): Promise<boolean> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/verify-email?token=${verificationToken}`;
    const subject = 'Verify Your Email - YouTube Optimizer';
    const html = this.getEmailVerificationTemplate(name, verificationUrl);
    const text = this.getEmailVerificationText(name, verificationUrl);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendNewDeviceLoginEmail(
    email: string,
    name: string,
    deviceInfo: {
      browser?: string;
      os?: string;
      ip?: string;
      location?: string;
    },
  ): Promise<boolean> {
    const subject = 'New Device Login Detected - YouTube Optimizer';
    const html = this.getNewDeviceLoginEmailTemplate(name, deviceInfo);
    const text = this.getNewDeviceLoginEmailText(name, deviceInfo);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendAccountLockedEmail(
    email: string,
    name: string,
    unlockTime: Date,
  ): Promise<boolean> {
    const subject = 'Account Temporarily Locked - YouTube Optimizer';
    const html = this.getAccountLockedEmailTemplate(name, unlockTime);
    const text = this.getAccountLockedEmailText(name, unlockTime);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendSubscriptionChangedEmail(
    email: string,
    name: string,
    oldTier: string,
    newTier: string,
  ): Promise<boolean> {
    const subject = 'Subscription Plan Changed - YouTube Optimizer';
    const html = this.getSubscriptionChangedEmailTemplate(
      name,
      oldTier,
      newTier,
    );
    const text = this.getSubscriptionChangedEmailText(name, oldTier, newTier);

    return this.sendEmail({ to: email, subject, html, text });
  }

  async sendUsageLimitWarningEmail(
    email: string,
    name: string,
    usagePercentage: number,
    analysesRemaining: number,
  ): Promise<boolean> {
    const subject = 'Usage Limit Warning - YouTube Optimizer';
    const html = this.getUsageLimitWarningEmailTemplate(
      name,
      usagePercentage,
      analysesRemaining,
    );
    const text = this.getUsageLimitWarningEmailText(
      name,
      usagePercentage,
      analysesRemaining,
    );

    return this.sendEmail({ to: email, subject, html, text });
  }

  // ==================== EMAIL TEMPLATES ====================

  private getBaseEmailStyles(): string {
    return `
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .content h2 { color: #667eea; font-size: 22px; margin-top: 0; }
        .content p { margin: 15px 0; color: #555; }
        .button { display: inline-block; padding: 14px 32px; margin: 25px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; transition: transform 0.2s; }
        .button:hover { transform: translateY(-2px); }
        .info-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { background: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer p { margin: 5px 0; font-size: 13px; color: #666; }
        .footer a { color: #667eea; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .divider { height: 1px; background: #e9ecef; margin: 25px 0; }
      </style>
    `;
  }

  private getWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseEmailStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to YouTube Optimizer!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>We're thrilled to have you join our community of content creators who are serious about optimizing their YouTube presence.</p>
            
            <div class="info-box">
              <strong>🚀 Here's what you can do with YouTube Optimizer:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Analyze your video performance with AI-powered insights</li>
                <li>Get personalized recommendations to boost engagement</li>
                <li>Track your channel growth and metrics</li>
                <li>Optimize titles, descriptions, and tags for better reach</li>
              </ul>
            </div>

            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard" class="button">Get Started Now</a>
            </p>

            <div class="divider"></div>

            <p><strong>Quick Tips to Get Started:</strong></p>
            <ol style="color: #555; margin: 10px 0 0 20px;">
              <li>Connect your YouTube channel</li>
              <li>Run your first video analysis</li>
              <li>Review AI-powered recommendations</li>
              <li>Implement changes and track improvements</li>
            </ol>

            <p>If you have any questions, feel free to reach out to our support team. We're here to help you succeed!</p>
          </div>
          <div class="footer">
            <p><strong>YouTube Optimizer Team</strong></p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard">Dashboard</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/support">Support</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/settings">Settings</a>
            </p>
            <p style="margin-top: 15px;">© ${new Date().getFullYear()} YouTube Optimizer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailText(name: string): string {
    return `
Welcome to YouTube Optimizer!

Hello ${name}!

We're thrilled to have you join our community of content creators who are serious about optimizing their YouTube presence.

Here's what you can do with YouTube Optimizer:
- Analyze your video performance with AI-powered insights
- Get personalized recommendations to boost engagement
- Track your channel growth and metrics
- Optimize titles, descriptions, and tags for better reach

Get Started: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard

Quick Tips to Get Started:
1. Connect your YouTube channel
2. Run your first video analysis
3. Review AI-powered recommendations
4. Implement changes and track improvements

If you have any questions, feel free to reach out to our support team. We're here to help you succeed!

Best regards,
YouTube Optimizer Team
    `;
  }

  private getPasswordResetEmailTemplate(
    name: string,
    resetUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseEmailStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>We received a request to reset your password for your YouTube Optimizer account.</p>
            
            <p>Click the button below to create a new password:</p>

            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset My Password</a>
            </p>

            <div class="warning-box">
              <strong>⚠️ Important Security Information:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>This link will expire in <strong>1 hour</strong></li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will remain unchanged</li>
              </ul>
            </div>

            <div class="divider"></div>

            <p style="font-size: 13px; color: #666;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>

            <p style="font-size: 13px; color: #666;">
              For security reasons, we cannot send your existing password. If you didn't request this reset, 
              your account may be at risk. Consider changing your password immediately and enabling two-factor authentication.
            </p>
          </div>
          <div class="footer">
            <p><strong>YouTube Optimizer Security Team</strong></p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/support">Contact Support</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/security">Security Center</a>
            </p>
            <p style="margin-top: 15px;">© ${new Date().getFullYear()} YouTube Optimizer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetEmailText(name: string, resetUrl: string): string {
    return `
Password Reset Request

Hello ${name},

We received a request to reset your password for your YouTube Optimizer account.

Reset your password by clicking this link:
${resetUrl}

IMPORTANT SECURITY INFORMATION:
- This link will expire in 1 hour
- If you didn't request this reset, please ignore this email
- Your password will remain unchanged

For security reasons, we cannot send your existing password. If you didn't request this reset, 
your account may be at risk. Consider changing your password immediately and enabling two-factor authentication.

Best regards,
YouTube Optimizer Security Team

Need help? Contact us at: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/support
    `;
  }

  private getPasswordChangedEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseEmailStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Successfully Changed</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Your YouTube Optimizer account password was successfully changed on ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}.</p>
            
            <div class="info-box">
              <strong>🔒 Your Account is Secure</strong>
              <p style="margin: 10px 0 0 0;">All active sessions have been terminated for security. You'll need to log in again with your new password.</p>
            </div>

            <div class="warning-box">
              <strong>⚠️ Didn't make this change?</strong>
              <p style="margin: 10px 0 0 0;">
                If you did not authorize this password change, your account may have been compromised. 
                Please contact our security team immediately.
              </p>
              <p style="text-align: center; margin-top: 15px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/support" class="button" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);">Report Unauthorized Access</a>
              </p>
            </div>

            <div class="divider"></div>

            <p><strong>Security Best Practices:</strong></p>
            <ul style="color: #555; margin: 10px 0;">
              <li>Use a unique password for each account</li>
              <li>Enable two-factor authentication</li>
              <li>Never share your password with anyone</li>
              <li>Update your password regularly</li>
            </ul>
          </div>
          <div class="footer">
            <p><strong>YouTube Optimizer Security Team</strong></p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/login">Login</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/support">Contact Support</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/security">Security Center</a>
            </p>
            <p style="margin-top: 15px;">© ${new Date().getFullYear()} YouTube Optimizer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordChangedEmailText(name: string): string {
    return `
Password Successfully Changed

Hello ${name},

Your YouTube Optimizer account password was successfully changed on ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}.

Your Account is Secure:
All active sessions have been terminated for security. You'll need to log in again with your new password.

DIDN'T MAKE THIS CHANGE?
If you did not authorize this password change, your account may have been compromised. 
Please contact our security team immediately at: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/support

Security Best Practices:
- Use a unique password for each account
- Enable two-factor authentication
- Never share your password with anyone
- Update your password regularly

Best regards,
YouTube Optimizer Security Team
    `;
  }

  private getEmailVerificationTemplate(
    name: string,
    verificationUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseEmailStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Verify Your Email Address</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Thank you for registering with YouTube Optimizer! We're excited to have you on board.</p>
            
            <p>To complete your registration and activate your account, please verify your email address by clicking the button below:</p>

            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify My Email</a>
            </p>

            <div class="info-box">
              <strong>📝 Why verify your email?</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Secure your account</li>
                <li>Receive important notifications</li>
                <li>Reset your password if needed</li>
                <li>Get updates on new features</li>
              </ul>
            </div>

            <div class="divider"></div>

            <p style="font-size: 13px; color: #666;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>

            <p style="font-size: 13px; color: #666;">
              This verification link will expire in <strong>24 hours</strong>. If you didn't create an account with YouTube Optimizer, 
              you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            <p><strong>YouTube Optimizer Team</strong></p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/support">Support</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/faq">FAQ</a>
            </p>
            <p style="margin-top: 15px;">© ${new Date().getFullYear()} YouTube Optimizer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getEmailVerificationText(
    name: string,
    verificationUrl: string,
  ): string {
    return `
Verify Your Email Address

Hello ${name},

Thank you for registering with YouTube Optimizer! We're excited to have you on board.

To complete your registration and activate your account, please verify your email address by clicking this link:
${verificationUrl}

Why verify your email?
- Secure your account
- Receive important notifications
- Reset your password if needed
- Get updates on new features

This verification link will expire in 24 hours. If you didn't create an account with YouTube Optimizer, 
you can safely ignore this email.

Best regards,
YouTube Optimizer Team

Need help? Visit: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/support
    `;
  }

  private getNewDeviceLoginEmailTemplate(
    name: string,
    deviceInfo: {
      browser?: string;
      os?: string;
      ip?: string;
      location?: string;
    },
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseEmailStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 New Device Login Detected</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>We detected a new login to your YouTube Optimizer account from a device we don't recognize.</p>
            
            <div class="info-box">
              <strong>🖥️ Login Details:</strong>
              <ul style="margin: 10px 0; padding-left: 20px; list-style: none;">
                <li><strong>Time:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</li>
                ${deviceInfo.browser ? `<li><strong>Browser:</strong> ${deviceInfo.browser}</li>` : ''}
                ${deviceInfo.os ? `<li><strong>Operating System:</strong> ${deviceInfo.os}</li>` : ''}
                ${deviceInfo.ip ? `<li><strong>IP Address:</strong> ${deviceInfo.ip}</li>` : ''}
                ${deviceInfo.location ? `<li><strong>Location:</strong> ${deviceInfo.location}</li>` : ''}
              </ul>
            </div>

            <p><strong>Was this you?</strong></p>
            <p>If you recognize this login, you can safely ignore this email. Your account remains secure.</p>

            <div class="warning-box">
              <strong>⚠️ Suspicious activity?</strong>
              <p style="margin: 10px 0 0 0;">
                If you didn't log in from this device, your account may be compromised. We recommend:
              </p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Change your password immediately</li>
                <li>Review recent account activity</li>
                <li>Enable two-factor authentication</li>
              </ul>
              <p style="text-align: center; margin-top: 15px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/security/change-password" class="button" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);">Secure My Account</a>
              </p>
            </div>
          </div>
          <div class="footer">
            <p><strong>YouTube Optimizer Security Team</strong></p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/security">Security Center</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/support">Contact Support</a>
            </p>
            <p style="margin-top: 15px;">© ${new Date().getFullYear()} YouTube Optimizer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getNewDeviceLoginEmailText(
    name: string,
    deviceInfo: {
      browser?: string;
      os?: string;
      ip?: string;
      location?: string;
    },
  ): string {
    return `
New Device Login Detected

Hello ${name},

We detected a new login to your YouTube Optimizer account from a device we don't recognize.

Login Details:
- Time: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
${deviceInfo.browser ? `- Browser: ${deviceInfo.browser}` : ''}
${deviceInfo.os ? `- Operating System: ${deviceInfo.os}` : ''}
${deviceInfo.ip ? `- IP Address: ${deviceInfo.ip}` : ''}
${deviceInfo.location ? `- Location: ${deviceInfo.location}` : ''}

Was this you?
If you recognize this login, you can safely ignore this email. Your account remains secure.

Suspicious activity?
If you didn't log in from this device, your account may be compromised. We recommend:
- Change your password immediately
- Review recent account activity
- Enable two-factor authentication

Secure your account: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/security/change-password

Best regards,
YouTube Optimizer Security Team
    `;
  }

  private getAccountLockedEmailTemplate(
    name: string,
    unlockTime: Date,
  ): string {
    const minutesUntilUnlock = Math.ceil(
      (unlockTime.getTime() - Date.now()) / (1000 * 60),
    );

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseEmailStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);">
            <h1>🔒 Account Temporarily Locked</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Your YouTube Optimizer account has been temporarily locked due to multiple failed login attempts.</p>
            
            <div class="warning-box">
              <strong>⏱️ Lockout Information:</strong>
              <ul style="margin: 10px 0; padding-left: 20px; list-style: none;">
                <li><strong>Locked at:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</li>
                <li><strong>Unlocks at:</strong> ${unlockTime.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</li>
                <li><strong>Time remaining:</strong> Approximately ${minutesUntilUnlock} minute${minutesUntilUnlock !== 1 ? 's' : ''}</li>
              </ul>
            </div>

            <p><strong>Why was my account locked?</strong></p>
            <p>We detected multiple unsuccessful login attempts. This is a security measure to protect your account from unauthorized access.</p>

            <div class="info-box">
              <strong>🛡️ What you can do:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Wait for the lockout period to expire</li>
                <li>If you forgot your password, reset it after the lockout</li>
                <li>Ensure you're using the correct email address</li>
                <li>Contact support if you suspect unauthorized access</li>
              </ul>
            </div>

            <p style="text-align: center; margin-top: 25px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/forgot-password" class="button">Reset Password</a>
            </p>
          </div>
          <div class="footer">
            <p><strong>YouTube Optimizer Security Team</strong></p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/support">Contact Support</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/security">Security Center</a>
            </p>
            <p style="margin-top: 15px;">© ${new Date().getFullYear()} YouTube Optimizer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getAccountLockedEmailText(name: string, unlockTime: Date): string {
    const minutesUntilUnlock = Math.ceil(
      (unlockTime.getTime() - Date.now()) / (1000 * 60),
    );

    return `
Account Temporarily Locked

Hello ${name},

Your YouTube Optimizer account has been temporarily locked due to multiple failed login attempts.

Lockout Information:
- Locked at: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
- Unlocks at: ${unlockTime.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
- Time remaining: Approximately ${minutesUntilUnlock} minute${minutesUntilUnlock !== 1 ? 's' : ''}

Why was my account locked?
We detected multiple unsuccessful login attempts. This is a security measure to protect your account from unauthorized access.

What you can do:
- Wait for the lockout period to expire
- If you forgot your password, reset it after the lockout
- Ensure you're using the correct email address
- Contact support if you suspect unauthorized access

Reset password: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/forgot-password

Best regards,
YouTube Optimizer Security Team
    `;
  }

  private getSubscriptionChangedEmailTemplate(
    name: string,
    oldTier: string,
    newTier: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseEmailStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎊 Subscription Plan Changed</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>Your YouTube Optimizer subscription plan has been successfully updated!</p>
            
            <div class="info-box">
              <strong>📋 Subscription Update:</strong>
              <ul style="margin: 10px 0; padding-left: 20px; list-style: none;">
                <li><strong>Previous Plan:</strong> ${oldTier.toUpperCase()}</li>
                <li><strong>New Plan:</strong> ${newTier.toUpperCase()}</li>
                <li><strong>Effective Date:</strong> ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}</li>
              </ul>
            </div>

            <p><strong>What's included in your ${newTier.toUpperCase()} plan:</strong></p>
            ${this.getSubscriptionFeaturesList(newTier)}

            <p style="text-align: center; margin-top: 25px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard" class="button">View Dashboard</a>
            </p>

            <div class="divider"></div>

            <p style="font-size: 13px; color: #666;">
              You can view your subscription details and manage your plan anytime from your account settings.
            </p>
          </div>
          <div class="footer">
            <p><strong>YouTube Optimizer Team</strong></p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/subscription">Manage Subscription</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/support">Support</a>
            </p>
            <p style="margin-top: 15px;">© ${new Date().getFullYear()} YouTube Optimizer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getSubscriptionChangedEmailText(
    name: string,
    oldTier: string,
    newTier: string,
  ): string {
    return `
Subscription Plan Changed

Hello ${name},

Your YouTube Optimizer subscription plan has been successfully updated!

Subscription Update:
- Previous Plan: ${oldTier.toUpperCase()}
- New Plan: ${newTier.toUpperCase()}
- Effective Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}

You can view your subscription details and manage your plan anytime from your account settings.

View Dashboard: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard

Best regards,
YouTube Optimizer Team
    `;
  }

  private getUsageLimitWarningEmailTemplate(
    name: string,
    usagePercentage: number,
    analysesRemaining: number,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseEmailStyles()}
      </head>
      <body>
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);">
            <h1>⚠️ Usage Limit Warning</h1>
          </div>
          <div class="content">
            <h2>Hello ${name},</h2>
            <p>You're approaching your monthly analysis limit for your current subscription plan.</p>
            
            <div class="warning-box">
              <strong>📊 Current Usage:</strong>
              <ul style="margin: 10px 0; padding-left: 20px; list-style: none;">
                <li><strong>Used:</strong> ${usagePercentage}% of your monthly allowance</li>
                <li><strong>Analyses Remaining:</strong> ${analysesRemaining}</li>
              </ul>
            </div>

            <p><strong>What happens when you reach the limit?</strong></p>
            <p>Once you've used all your analyses for this billing period, you won't be able to analyze new videos until your next billing cycle or you can upgrade your plan for more capacity.</p>

            <div class="info-box">
              <strong>💡 Consider upgrading:</strong>
              <p style="margin: 10px 0 0 0;">
                Get more analyses and unlock premium features with our PRO or PREMIUM plans.
              </p>
            </div>

            <p style="text-align: center; margin-top: 25px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/pricing" class="button">View Plans & Pricing</a>
            </p>
          </div>
          <div class="footer">
            <p><strong>YouTube Optimizer Team</strong></p>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/dashboard">Dashboard</a> | 
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/subscription">Manage Subscription</a>
            </p>
            <p style="margin-top: 15px;">© ${new Date().getFullYear()} YouTube Optimizer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getUsageLimitWarningEmailText(
    name: string,
    usagePercentage: number,
    analysesRemaining: number,
  ): string {
    return `
Usage Limit Warning

Hello ${name},

You're approaching your monthly analysis limit for your current subscription plan.

Current Usage:
- Used: ${usagePercentage}% of your monthly allowance
- Analyses Remaining: ${analysesRemaining}

What happens when you reach the limit?
Once you've used all your analyses for this billing period, you won't be able to analyze new videos until your next billing cycle or you can upgrade your plan for more capacity.

Consider upgrading to get more analyses and unlock premium features with our PRO or PREMIUM plans.

View Plans: ${process.env.FRONTEND_URL || 'http://localhost:4200'}/pricing

Best regards,
YouTube Optimizer Team
    `;
  }

  private getSubscriptionFeaturesList(tier: string): string {
    const tierLower = tier.toLowerCase();

    const features: Record<string, string[]> = {
      free: [
        '10 analyses per month',
        '1 channel connection',
        'Basic analytics',
        '3 AI suggestions per analysis',
      ],
      pro: [
        '100 analyses per month',
        '3 channel connections',
        'Advanced analytics',
        '10 AI suggestions per analysis',
        'API access',
        'Export features',
      ],
      premium: [
        '500 analyses per month',
        '10 channel connections',
        'Advanced analytics',
        '25 AI suggestions per analysis',
        'Priority support',
        'API access',
        'Bulk operations',
        'Export features',
      ],
      enterprise: [
        'Unlimited analyses',
        'Unlimited channel connections',
        'Advanced analytics',
        'Unlimited AI suggestions',
        'Priority support',
        'Custom branding',
        'API access',
        'Bulk operations',
        'Export features',
        'Third-party integrations',
      ],
    };

    const tierFeatures = features[tierLower] || features.free;

    return `
      <ul style="color: #555; margin: 10px 0; padding-left: 20px;">
        ${tierFeatures.map((feature) => `<li>${feature}</li>`).join('')}
      </ul>
    `;
  }
}
