import {
  Client,
  GatewayIntentBits,
  ActivityType,
  Events,
  Partials,
} from "discord.js";

import http from "http";
import { closePool } from "./src/db";
import { validateEnv } from "./src/env";
import { logError } from "./src/logger";
import { startTimeCheckCron } from "./src/cron/timeCheck";
import { registerDMListener } from "./src/listener/receivedDM";
import { startTwitchLiveChecker } from "./src/services/notifiers/Twitch";
import { startOwnerWellbeingCron } from "./src/cron/selfcare";
import { startOwnerMorningScheduleCron } from "./src/cron/sessionsToday";
import { startCoachingWebhookServer } from "./src/http/coachingWebhookServer";

validateEnv();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

let httpServer: http.Server | null = null;

/** Listen immediately so platform health checks work before Discord is connected. */
httpServer = startCoachingWebhookServer(client);

let shuttingDown = false;
async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[shutdown] Stopping…");

  await new Promise<void>((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }
    httpServer.close(() => resolve());
  }).catch((err) => logError("shutdown http", err));

  client.destroy();

  await closePool().catch((err) => logError("shutdown pool", err));

  console.log("[shutdown] Done.");
  process.exit(0);
}

process.on("SIGINT", () => void gracefulShutdown());
process.on("SIGTERM", () => void gracefulShutdown());

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);

  client.user?.setPresence({
    activities: [{ name: "I AM A BUTTERFLY", type: ActivityType.Watching }],
    status: "online",
  });

  startTimeCheckCron(client);
  registerDMListener(client);
  startTwitchLiveChecker(client);

  // Your self-care DMs
  startOwnerWellbeingCron(client);

  // Your 8am daily schedule summary
  startOwnerMorningScheduleCron(client);
});

client.login(DISCORD_TOKEN);