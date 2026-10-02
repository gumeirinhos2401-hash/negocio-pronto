export interface Message { to: string; subject: string; text: string }
export interface Mailer { send(message: Message): Promise<void> }

// Development: nothing is sent. The message is printed so the link can be opened by hand.
export const consoleMailer: Mailer = {
  async send(message) {
    console.log(`\n[email não enviado, modo de desenvolvimento]\nPara: ${message.to}\nAssunto: ${message.subject}\n\n${message.text}\n`);
  },
};

// Production without a mail provider: fail loudly instead of printing links into logs.
export const missingMailer: Mailer = {
  async send() {
    throw new Error('Mail is not configured: set RESEND_API_KEY and MAIL_FROM.');
  },
};

// Sends through the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Not exercised by the tests: it needs a real key and a verified sender domain.
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(message) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      });
      if (!response.ok) throw new Error(`Mail provider answered ${response.status}`);
    },
  };
}
