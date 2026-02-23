import { EmbedBuilder, type Client } from "discord.js";

const OWNER_ID = process.env.OWNER_ID!;

export type OwnerWellbeingKind = "late" | "water" | "break";

export async function notifyOwnerWellbeing(
  client: Client,
  kind: OwnerWellbeingKind
) {
  const owner = await client.users.fetch(OWNER_ID).catch(() => null);
  if (!owner) return false;

  const title =
    kind === "late"
      ? "🚨 Commander, it's getting late."
      : kind === "water"
      ? "💧 Hydration check."
      : "🧠 Tactical Pause.";

  const description =
    kind === "late"
      ? [
          `You’ve been grinding.`,
          ``,
          `Time to decide:`,
          `• What *must* happen today?`,
          `• What can wait until tomorrow?`,
          ``,
          `Close the day on purpose. Not by exhaustion.`,
        ].join("\n")
      : kind === "water"
      ? [
          `Stand up.`,
          `Drink water.`,
          `Deep breath.`,
          ``,
          `You are a high-performance organism.`,
          `Maintain the machine.`,
        ].join("\n")
      : [
          `Pause.`,
          ``,
          `Are you working on the highest-leverage thing right now?`,
          ``,
          `If yes → continue.`,
          `If no → switch.`,
          ``,
          `Obsession is power.`,
          `Aim it.`,
        ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(
      kind === "late"
        ? 0xed4245 // red
        : kind === "water"
        ? 0x57f287 // green
        : 0x5865f2 // blurple
    )
    .setTitle(title)
    .setDescription(description)
    .setTimestamp(new Date());

  await owner.send({ embeds: [embed] }).catch(() => {});
  return true;
}