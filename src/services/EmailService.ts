export class EmailService {
  static async sendWelcomeEmail(toEmail: string, fullName?: string) {
    try {
      const webhook = import.meta.env.VITE_WELCOME_EMAIL_WEBHOOK_URL as string | undefined;
      if (!webhook) return { success: false, error: 'WELCOME_EMAIL_WEBHOOK not configured' };

      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          subject: 'Welcome to Design Asia ETM',
          html: `<p>Hi ${fullName || 'there'},</p><p>Welcome to Design Asia ETM. You can log in using the link below:</p><p><a href="https://www.designasiaetm.site/login" target="_blank" rel="noopener">www.designasiaetm.site/login</a></p>`
        })
      });

      if (!res.ok) return { success: false, error: `Webhook responded ${res.status}` };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}


