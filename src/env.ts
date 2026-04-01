const REQUIRED = [
  "DISCORD_TOKEN",
  "DIRECT_DATABASE_URL",
  "OWNER_ID",
  "INBOX_CHANNEL_ID",
  "DISCORD_SERVER_ID",
  "STAGE_CHANNEL_ID",
  "DISCORD_BOT_WEBHOOK_SECRET",
  "DISCORD_BOT_WEBHOOK_URL",
] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error("[env] Missing required variables:");
    missing.forEach((key) => console.error(`  - ${key}`));
    console.error("Set them in .env and try again.");
    process.exit(1);
  }
}
