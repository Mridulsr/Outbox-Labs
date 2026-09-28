import nodemailer, { type Transporter } from 'nodemailer';

let mailTransporter: Transporter | null = null;
let currentCredentials: { user: string; pass: string; webUrl?: string } | null = null;

export async function getTransporter(): Promise<Transporter> {
  if (mailTransporter) {
    return mailTransporter;
  }

  const envUser = process.env.ETHEREAL_USER;
  const envPass = process.env.ETHEREAL_PASS;

  if (envUser && envPass) {
    console.log(`[Mail] Using configured Ethereal credentials: ${envUser}`);
    currentCredentials = { user: envUser, pass: envPass };
    mailTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: envUser,
        pass: envPass,
      },
    });
  } else {
    console.log('[Mail] Creating fresh Ethereal test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[Mail] Ethereal account created: ${testAccount.user}`);
      currentCredentials = {
        user: testAccount.user,
        pass: testAccount.pass,
        webUrl: testAccount.web,
      };

      mailTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err: any) {
      console.warn('[Mail] Fallback mock transporter due to network error creating test account:', err.message);
      // Fallback JSON / stream transport if offline
      mailTransporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return mailTransporter;
}

export async function getMailCredentials() {
  if (!currentCredentials) {
    await getTransporter();
  }
  return currentCredentials;
}

export async function sendEmail(params: {
  sender: string;
  recipient: string;
  subject: string;
  body: string;
}): Promise<{ messageId: string; etherealUrl: string | null }> {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: `"ReachInbox Outreach" <${params.sender}>`,
    to: params.recipient,
    subject: params.subject,
    text: params.body,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 20px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 600;">ReachInbox Campaign</h2>
          <p style="margin: 4px 0 0; opacity: 0.85; font-size: 13px;">Sender: ${params.sender}</p>
        </div>
        <div style="padding: 24px; background: #ffffff;">
          <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">${params.subject}</h3>
          <div style="white-space: pre-wrap; color: #334155; font-size: 15px; margin: 16px 0;">
            ${params.body}
          </div>
        </div>
        <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
          Sent via ReachInbox.ai Production Email Scheduler & BullMQ Engine.
        </div>
      </div>
    `,
  });

  const etherealUrl = nodemailer.getTestMessageUrl(info) || null;
  console.log(`[Mail] Email sent to ${params.recipient}. Ethereal Preview: ${etherealUrl || 'N/A'}`);

  return {
    messageId: info.messageId,
    etherealUrl: typeof etherealUrl === 'string' ? etherealUrl : null,
  };
}
