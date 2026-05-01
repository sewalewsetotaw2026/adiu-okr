import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import fs from "fs";
import { Resend } from "resend";
import * as Brevo from "@getbrevo/brevo";

/**
 * Email Provider Types
 * - nodemailer/smtp: Use SMTP via Nodemailer
 * - resend: Use Resend API
 * - brevo: Use Brevo API
 */
export type EmailProvider = "nodemailer" | "smtp" | "resend" | "brevo";

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Mail.Attachment[];
}

interface EmailResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

const parseTimeoutMs = (value: string | undefined, fallbackMs: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return Math.floor(parsed);
};

/**
 * Get the configured email provider
 *
 * Environment Variable: EMAIL_PROVIDER
 * Values: "nodemailer" | "smtp" | "resend" | "brevo"
 *
 * Fallback logic:
 * 1. If EMAIL_PROVIDER is set, use that
 * 2. If RESEND_API_KEY exists, use "resend"
 * 3. If BREVO_API_KEY exists, use "brevo"
 * 4. Default to "nodemailer" (SMTP)
 */
const getEmailProvider = (): EmailProvider => {
  const provider = String(process.env.EMAIL_PROVIDER || "")
    .toLowerCase()
    .trim();

  // Explicit provider configuration
  if (provider === "nodemailer" || provider === "smtp") {
    return "nodemailer";
  }
  if (provider === "resend") {
    return "resend";
  }
  if (provider === "brevo") {
    return "brevo";
  }

  // Auto-detect based on available credentials
  if (process.env.RESEND_API_KEY) {
    console.log(
      "[Email] No EMAIL_PROVIDER set, auto-detecting: Resend (RESEND_API_KEY found)"
    );
    return "resend";
  }

  if (process.env.BREVO_API_KEY) {
    console.log(
      "[Email] No EMAIL_PROVIDER set, auto-detecting: Brevo (BREVO_API_KEY found)"
    );
    return "brevo";
  }

  console.log(
    "[Email] No EMAIL_PROVIDER set, defaulting to: nodemailer (SMTP)"
  );
  return "nodemailer";
};

/**
 * Check if the email service is properly configured
 */
export const isEmailConfigured = (): {
  configured: boolean;
  provider: string;
  message: string;
} => {
  const provider = getEmailProvider();

  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) {
      return {
        configured: false,
        provider,
        message: "RESEND_API_KEY is not set",
      };
    }
    const from = process.env.RESEND_FROM || process.env.EMAIL_FROM;
    if (!from) {
      return {
        configured: false,
        provider,
        message: "RESEND_FROM or EMAIL_FROM is not set",
      };
    }
    return { configured: true, provider, message: "Resend is configured" };
  }

  if (provider === "brevo") {
    if (!process.env.BREVO_API_KEY) {
      return {
        configured: false,
        provider,
        message: "BREVO_API_KEY is not set",
      };
    }
    const from = process.env.BREVO_FROM || process.env.EMAIL_FROM;
    if (!from) {
      return {
        configured: false,
        provider,
        message: "BREVO_FROM or EMAIL_FROM is not set",
      };
    }

    return { configured: true, provider, message: "Brevo API is configured" };
  }

  // nodemailer/smtp
  const user = process.env.SMTP_USER || process.env.EMAIL_HOST_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_HOST_PASSWORD;

  if (!user || !pass) {
    return {
      configured: false,
      provider,
      message: "SMTP credentials not set (SMTP_USER/SMTP_PASS)",
    };
  }

  return {
    configured: true,
    provider,
    message: "SMTP/Nodemailer is configured",
  };
};

const sendWithResend = async (options: EmailOptions): Promise<EmailResult> => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[Email:Resend] RESEND_API_KEY is not set");
    return {
      success: false,
      provider: "resend",
      error: "RESEND_API_KEY is not set",
    };
  }

  const from =
    process.env.RESEND_FROM ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_HOST_USER;

  if (!from) {
    console.error(
      "[Email:Resend] Sender not configured (set RESEND_FROM or EMAIL_FROM)"
    );
    return {
      success: false,
      provider: "resend",
      error: "Sender email not configured",
    };
  }

  const replyTo = process.env.RESEND_REPLY_TO || process.env.EMAIL_REPLY_TO;
  const sendTimeout = parseTimeoutMs(
    process.env.RESEND_SEND_TIMEOUT_MS || process.env.EMAIL_SEND_TIMEOUT_MS,
    20_000
  );

  const attachments = await (async () => {
    if (!options.attachments || options.attachments.length === 0)
      return undefined;

    const mapped = [] as Array<{ filename: string; content: Buffer }>;

    for (const attachment of options.attachments) {
      const filename = String(attachment.filename || "").trim() || "attachment";

      if (typeof attachment.content === "string") {
        mapped.push({ filename, content: Buffer.from(attachment.content) });
        continue;
      }

      if (Buffer.isBuffer(attachment.content)) {
        mapped.push({ filename, content: attachment.content });
        continue;
      }

      if (typeof (attachment as any).path === "string") {
        try {
          const buf = await fs.promises.readFile((attachment as any).path);
          mapped.push({ filename, content: buf });
        } catch (err) {
          console.error(
            "[Email:Resend] Failed to read attachment:",
            (err as Error).message
          );
        }
      }
    }

    return mapped.length > 0 ? mapped : undefined;
  })();

  const resend = new Resend(apiKey);

  const text = options.text ?? (options.html ? undefined : "");
  const html = options.html;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Resend send timeout")), sendTimeout)
  );

  const isRetryable = (message: string) => {
    const m = message.toLowerCase();
    return (
      m.includes("timeout") ||
      m.includes("fetch") ||
      m.includes("network") ||
      m.includes("unable to fetch data") ||
      m.includes("could not be resolved") ||
      m.includes("econnreset")
    );
  };

  const sendOnce = async () => {
    return Promise.race([
      resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        ...(text !== undefined ? { text } : {}),
        ...(html ? { html } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(attachments
          ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
            })),
          }
          : {}),
      } as any),
      timeoutPromise,
    ]);
  };

  // Retry logic with exponential backoff
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(3, attempt) * 200; // 600ms, 1800ms, 5400ms
        await new Promise((r) => setTimeout(r, delay));
        console.log(`[Email:Resend] Retry attempt ${attempt}/${maxRetries}...`);
      }

      const result = await sendOnce();
      const errorObj = (result as any)?.error;

      if (!errorObj && (result as any)?.data?.id) {
        const id = (result as any).data.id;
        console.log(`[Email:Resend] Message sent successfully (Attempt ${attempt + 1}):`, id);
        return { success: true, provider: "resend", messageId: id };
      }

      const errorMessage = typeof errorObj === "string"
        ? errorObj
        : errorObj?.message || JSON.stringify(errorObj);

      lastError = errorMessage;

      if (!isRetryable(errorMessage)) {
        console.error(`[Email:Resend] Non-retryable error: ${errorMessage}`);
        break; // Don't retry fatal errors
      }

      console.warn(`[Email:Resend] Attempt ${attempt + 1} failed: ${errorMessage}`);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`[Email:Resend] Attempt ${attempt + 1} exception: ${lastError}`);

      if (!isRetryable(lastError)) break;
    }
  }

  // If Resend failed after retries, try SMTP fallback
  console.error(`[Email:Resend] All ${maxRetries + 1} attempts failed. Last error: ${lastError}`);

  // Check if SMTP is configured for fallback
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_HOST_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_HOST_PASSWORD;

  if (smtpUser && smtpPass) {
    console.log("[Email] Falling back to SMTP...");
    return sendWithSmtp(options);
  }

  return { success: false, provider: "resend", error: lastError };


};

const sendWithBrevo = async (options: EmailOptions): Promise<EmailResult> => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("[Email:Brevo] BREVO_API_KEY is not set");
    return {
      success: false,
      provider: "brevo",
      error: "BREVO_API_KEY is not set"
    };
  }

  const apiInstance = new Brevo.TransactionalEmailsApi();

  // Set API Key using the new method
  apiInstance.setApiKey(
    Brevo.TransactionalEmailsApiApiKeys.apiKey,
    apiKey
  );

  const sendSmtpEmail = new Brevo.SendSmtpEmail();

  // Configure Sender
  const fromStr = process.env.BREVO_FROM || process.env.EMAIL_FROM || "HR <no-reply@kacha.com>";
  let senderName = "Kacha HR";
  let senderEmail = fromStr;

  if (fromStr.includes("<") && fromStr.includes(">")) {
    const parts = fromStr.split("<");
    senderName = parts[0].trim().replace(/"/g, '');
    senderEmail = parts[1].replace(">", "").trim();
  } else {
    senderEmail = fromStr.trim();
  }

  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: options.to }];
  sendSmtpEmail.subject = options.subject;
  sendSmtpEmail.htmlContent = options.html || options.text || "No content";
  if (options.text) {
    sendSmtpEmail.textContent = options.text;
  }

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[Email:Brevo] Email sent successfully.`);

    // Correctly access messageId from the body
    const messageId = data.body.messageId;

    return { success: true, provider: "brevo", messageId: messageId };
  } catch (error: any) {
    const errMsg = error?.response?.body?.message || error.message || JSON.stringify(error);
    console.error(`[Email:Brevo] Failed to send email: ${errMsg}`);
    return { success: false, provider: "brevo", error: errMsg };
  }
};

const sendWithSmtp = async (options: EmailOptions): Promise<EmailResult> => {
  // SMTP/Nodemailer configuration
  const host =
    process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = parseInt(
    process.env.SMTP_PORT || process.env.EMAIL_PORT || "587",
    10
  );
  const user = process.env.SMTP_USER || process.env.EMAIL_HOST_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_HOST_PASSWORD;

  // Nodemailer requires `secure: true` for port 465 (SMTPS).
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
    port === 465;

  // Timeout configurations
  const connectionTimeout = parseTimeoutMs(
    process.env.SMTP_CONNECTION_TIMEOUT_MS,
    10_000
  );
  const greetingTimeout = parseTimeoutMs(
    process.env.SMTP_GREETING_TIMEOUT_MS,
    10_000
  );
  const socketTimeout = parseTimeoutMs(
    process.env.SMTP_SOCKET_TIMEOUT_MS,
    20_000
  );
  const sendTimeout = parseTimeoutMs(
    process.env.SMTP_SEND_TIMEOUT_MS || process.env.EMAIL_SEND_TIMEOUT_MS,
    20_000
  );

  if (!user || !pass) {
    console.error(
      "[Email:Nodemailer] Credentials not configured:",
      JSON.stringify(
        {
          host,
          port,
          secure,
          hasUser: Boolean(user),
          hasPass: Boolean(pass),
        },
        null,
        2
      )
    );
    return {
      success: false,
      provider: "nodemailer",
      error: "SMTP credentials not configured",
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: port === 587 ? true : undefined,
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
  });

  // Define email options
  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      process.env.EMAIL_HOST_USER ||
      '"Employee Management System" <noreply@ems.com>',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
  };

  // Send email
  try {
    const info = await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP send timeout")), sendTimeout)
      ),
    ]);
    console.log("[Email:Nodemailer] Message sent:", info.messageId);
    return { success: true, provider: "nodemailer", messageId: info.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      "[Email:Nodemailer] Send failed:",
      JSON.stringify(
        {
          host,
          port,
          secure,
          to: options.to,
          subject: options.subject,
          error: errorMessage,
        },
        null,
        2
      )
    );
    return { success: false, provider: "nodemailer", error: errorMessage };
  }
};

/**
 * Send an email using the configured provider
 *
 * Provider is determined by EMAIL_PROVIDER environment variable:
 * - "nodemailer" or "smtp": Use SMTP via Nodemailer
 * - "resend": Use Resend API
 * - "brevo": Use Brevo API
 *
 * If not set, auto-detects based on available credentials.
 */
export const sendEmail = async (
  options: EmailOptions
): Promise<EmailResult> => {
  // Skip email sending in test environment
  if (process.env.NODE_ENV === 'test') {
    console.log(`[Email] Skipping email in test environment to: ${options.to}`);
    return { success: true, provider: 'test', messageId: 'test-skip' };
  }

  const provider = getEmailProvider();

  console.log(`[Email] Sending via ${provider} to: ${options.to}`);

  if (provider === "resend") {
    return sendWithResend(options);
  }

  if (provider === "brevo") {
    return sendWithBrevo(options);
  }

  return sendWithSmtp(options);
};

/**
 * Get the current email provider name (for logging/debugging)
 */
export const getCurrentEmailProvider = (): string => {
  return getEmailProvider();
};
