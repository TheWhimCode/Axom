import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
} from "discord.js";
import { logError } from "../../logger";

export type SpeedReviewReminderPayload = {
  discordId: string;
  queueEntryId: string;
  position: number;
  nextSessionAt: Date;
};

function buildQueueMessage(position: number, nextSessionAt: Date): string {
  const unix = Math.floor(nextSessionAt.getTime() / 1000);
  const intro = `**Hellooo!!** quick reminder :sparkles:\n> Speedreviews Event: <t:${unix}:F>\n> Queue Spot: **#${position}**\n`;

  if (position <= 4) {
    return `${intro}\nYou're in the **top 4** of the queue- so you'll 100% get reviewed if you're there!`;
  }

  if (position <= 8) {
    return `${intro}\nYou're pretty high in the queue - you might be reviewed if someone else doesn't show up!`;
  }

  return `${intro}\nUnless multiple people don't show up, you likely won't be reviewed this time — but you can listen in anyways!`;
}

export async function notifySpeedReviewReminder(
  client: Client,
  payload: SpeedReviewReminderPayload
): Promise<boolean> {
  const user = await client.users.fetch(payload.discordId).catch(() => null);
  if (!user) return false;

  const message = buildQueueMessage(payload.position, payload.nextSessionAt);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`speed_review_optout:${payload.queueEntryId}`)
      .setLabel("Stop Speed Review reminders")
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await user.send({
      content: message,
      components: [row],
    });
    return true;
  } catch (err) {
    logError("speedReviewReminderDM", err);
    return false;
  }
}
