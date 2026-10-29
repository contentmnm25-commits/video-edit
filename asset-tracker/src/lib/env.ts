import "server-only";

function list(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  appSecret: process.env.APP_SECRET ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  allowedDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
  adminEmails: list(process.env.ADMIN_EMAILS),
  devLogin: process.env.ALLOW_DEV_LOGIN === "true",
  storageDriver: (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 2048) * 1024 * 1024,
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? "",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "Creative Tracker <tracker@localhost>",
  },
  get googleEnabled() {
    return Boolean(this.googleClientId && this.googleClientSecret);
  },
};

export function requireSecret() {
  if (env.appSecret.length < 16) {
    throw new Error("APP_SECRET must be set to a long random string (see .env.example).");
  }
  return env.appSecret;
}
