import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { register } from 'prom-client';
import * as https from 'https';

interface AlertRule {
  name: string;
  metricName: string;
  threshold: number;
  comparison: 'greater' | 'less';
  message: string;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private alertHistory: Map<string, number> = new Map(); // Track last alert time
  private readonly cooldownMs = 300000; // 5 minutes between same alerts

  // Define your alert rules here
  private readonly alertRules: AlertRule[] = [
    {
      name: 'high_error_rate',
      metricName: 'youtube_optimizer_errors_total',
      threshold: 10,
      comparison: 'greater',
      message: '🚨 High error rate detected! Errors: {value}',
    },
    {
      name: 'high_ai_failure_rate',
      metricName: 'youtube_optimizer_ai_requests_total',
      threshold: 5,
      comparison: 'greater',
      message: '⚠️ AI service failures detected: {value}',
    },
    {
      name: 'high_rate_limit',
      metricName: 'youtube_optimizer_rate_limit_exceeded_total',
      threshold: 50,
      comparison: 'greater',
      message: '🛑 High rate limit violations: {value}',
    },
  ];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check metrics every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAlerts() {
    try {
      const metrics: any = await register.getMetricsAsJSON();

      for (const rule of this.alertRules) {
        await this.evaluateRule(rule, metrics);
      }
    } catch (error) {
      this.logger.error(
        `Error checking alerts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async evaluateRule(rule: AlertRule, metrics: any[]) {
    const metric = metrics.find((m: any) => m.name === rule.metricName);
    if (!metric?.values || metric.values.length === 0) return;

    // Sum up all metric values
    const totalValue = metric.values.reduce(
      (sum: number, v: any) => sum + (v.value || 0),
      0,
    );

    // Check if threshold is breached
    let shouldAlert = false;
    if (rule.comparison === 'greater' && totalValue > rule.threshold) {
      shouldAlert = true;
    } else if (rule.comparison === 'less' && totalValue < rule.threshold) {
      shouldAlert = true;
    }

    if (shouldAlert) {
      await this.sendAlert(rule, totalValue);
    }
  }

  private async sendAlert(rule: AlertRule, value: number) {
    // Check cooldown to prevent alert spam
    const lastAlertTime = this.alertHistory.get(rule.name) || 0;
    const now = Date.now();

    if (now - lastAlertTime < this.cooldownMs) {
      return; // Still in cooldown period
    }

    const message = rule.message.replace('{value}', value.toString());
    this.logger.warn(`🔔 ALERT: ${message}`);

    // Update alert history
    this.alertHistory.set(rule.name, now);

    // Send to configured channels
    await Promise.allSettled([
      this.sendTelegramAlert(message),
      this.sendEmailAlert(rule.name, message),
      this.sendWhatsAppAlert(message),
    ]);
  }

  /**
   * Send alert via Telegram Bot
   */
  private async sendTelegramAlert(message: string): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID');

    if (!botToken || !chatId) {
      return; // Telegram not configured
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const data = JSON.stringify({
        chat_id: chatId,
        text: `🚨 YouTube Optimizer Alert\n\n${message}\n\nTime: ${new Date().toISOString()}`,
        parse_mode: 'HTML',
      });

      await this.makeHttpsRequest(url, 'POST', data, {
        'Content-Type': 'application/json',
      });

      this.logger.log('✅ Telegram alert sent');
    } catch (error) {
      this.logger.error(
        `Failed to send Telegram alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Send alert via Email
   */
  private async sendEmailAlert(
    alertName: string,
    message: string,
  ): Promise<void> {
    const alertEmail = this.configService.get<string>('ALERT_EMAIL');

    if (!alertEmail) {
      return; // Email not configured
    }

    // TODO: Integrate with your existing nodemailer service
    this.logger.log(`📧 Email alert would be sent to: ${alertEmail}`);
    // You can import and use your existing email service here
  }

  /**
   * Send alert via WhatsApp (using Twilio)
   */
  private async sendWhatsAppAlert(message: string): Promise<void> {
    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioFrom = this.configService.get<string>('TWILIO_WHATSAPP_FROM');
    const twilioTo = this.configService.get<string>('TWILIO_WHATSAPP_TO');

    if (!twilioSid || !twilioToken || !twilioFrom || !twilioTo) {
      return; // WhatsApp not configured
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString(
        'base64',
      );

      const data = new URLSearchParams({
        From: twilioFrom, // e.g., 'whatsapp:+14155238886'
        To: twilioTo, // e.g., 'whatsapp:+1234567890'
        Body: `🚨 YouTube Optimizer Alert\n\n${message}`,
      }).toString();

      await this.makeHttpsRequest(url, 'POST', data, {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      });

      this.logger.log('✅ WhatsApp alert sent');
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Helper to make HTTPS requests
   */
  private makeHttpsRequest(
    url: string,
    method: string,
    data: string,
    headers: Record<string, string>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(data),
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Manually trigger an alert (for testing)
   */
  async testAlert(channel: 'telegram' | 'email' | 'whatsapp') {
    const message = '🧪 This is a test alert from YouTube Optimizer';

    switch (channel) {
      case 'telegram':
        await this.sendTelegramAlert(message);
        break;
      case 'email':
        await this.sendEmailAlert('test', message);
        break;
      case 'whatsapp':
        await this.sendWhatsAppAlert(message);
        break;
    }

    return { success: true, message: `Test alert sent to ${channel}` };
  }
}
