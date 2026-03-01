import type { Client } from "discord.js";
import { logError } from "../../../logger";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import crypto from "node:crypto";
import type { StudentConfirmPayload } from "./index";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type HasFollowupOpts = {
  closingLine: string;
};

async function sendClosingLineWithTyping(
  channel: { sendTyping: () => Promise<void>; send: (content: string) => Promise<any> },
  closingLine: string
) {
  await channel.sendTyping();
  await sleep(2000);
  await channel.send(closingLine);
}

export async function sendHasFollowupDM(
  client: Client,
  p: StudentConfirmPayload,
  opts: HasFollowupOpts
): Promise<boolean> {
  const { discordId } = p;
  if (!discordId) return false;

  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return false;

  const closingLine = opts.closingLine;

  try {
    const channel = await user.createDM();

    // typing before the followup prompt
    await channel.sendTyping();
    await sleep(5000);

    const baseId = crypto.randomUUID();
    const noClueId = `followup_noclue:${baseId}`;
    const iKnowId = `followup_iknow:${baseId}`;

    const noClueBtn = new ButtonBuilder()
      .setCustomId(noClueId)
      .setLabel("No clue ❓")
      .setStyle(ButtonStyle.Primary);

    const iKnowBtn = new ButtonBuilder()
      .setCustomId(iKnowId)
      .setLabel("I know ❗")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      noClueBtn,
      iKnowBtn
    );

    const msg = [
      `> Oh, and one more thing 📝`,
      ``,
      `You purchased a follow-up. Do you... know what that is?`,
    ].join("\n");

    const sent = await channel.send({
      content: msg,
      components: [row],
    });

    const interaction = await sent
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 1000 * 60 * 60 * 24 * 7,
        filter: (i) =>
          i.user.id === user.id &&
          (i.customId === noClueId || i.customId === iKnowId),
      })
      .catch(() => null);

    if (!interaction) return true;

    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ButtonBuilder.from(noClueBtn).setDisabled(true),
      ButtonBuilder.from(iKnowBtn).setDisabled(true)
    );

    await interaction.deferUpdate().catch(() => {});
    await sent.edit({ components: [disabledRow] }).catch(() => {});

    // typing after button press (3s)
    await channel.sendTyping();
    await sleep(3000);

    if (interaction.customId === noClueId) {
      await channel.send(
        [
          "Okay, so basically: After the session you take some time to practise.",
          "",
          "**Once you feel ready,** send Sho a game to review (just the KDA is fine). 🔎",
          "He'll send you a 15-20 minute review video to give you the *next skills to work on.*",
          "",
          "It's basically a second coaching session! ⚡",
          "https://www.patreon.com/posts/azir-emerald-up-123493426",
        ].join("\n")
      );
    } else {
      await channel.send("Perfect!");
    }

    // ✅ closing line ALWAYS last (2s typing), controlled by index.ts
    await sendClosingLineWithTyping(channel, closingLine);

    return true;
  } catch (err) {
    logError("sendHasFollowupDM", err);
    return false;
  }
}