export type OwnerWellbeingKind = "late" | "water" | "break";

export type WellbeingLine = {
  title: string;
  description: string;
  color: number;
  weight?: number;
};

const RED = 0xed4245;
const GREEN = 0x57f287;
const BLURPLE = 0x5865f2;

export const OWNER_WELLBEING_LINES: Record<
  OwnerWellbeingKind,
  WellbeingLine[]
> = {
  // ===================== LATE =====================
  late: [
    {
      title: "hey… it’s getting kinda late",
      description: [
        "don’t let tonight steal from tomorrow 🤍",
        "",
        "one clean final move",
        "then we rest",
      ].join("\n"),
      color: RED,
    },
    {
      title: "okay bestie",
      description: [
        "the “one more thing” trap is active rn 😭",
        "",
        "wrap it properly",
        "future-you will be so grateful",
      ].join("\n"),
      color: RED,
    },
    {
      title: "real quick before you spiral",
      description: [
        "pick ONE:",
        "• finish something tiny",
        "• or stop on purpose",
        "",
        "either is a win 🫶",
      ].join("\n"),
      color: RED,
    },
    {
      title: "gentle reminder",
      description: [
        "you’ve done enough today",
        "",
        "write tomorrow’s first step",
        "then close everything 😌",
      ].join("\n"),
      color: RED,
    },
    {
      title: "deal? 🤝",
      description: [
        "save progress",
        "set the next move for tomorrow",
        "",
        "and then you log off like a legend",
      ].join("\n"),
      color: RED,
    },
    {
      title: "pls don’t blur the ending",
      description: [
        "you can keep going…",
        "but it gets messy fast",
        "",
        "clean landing > extra grinding",
      ].join("\n"),
      color: RED,
    },
    {
      title: "okay commander 🫡",
      description: [
        "tomorrow-you needs energy",
        "",
        "write the next action",
        "then sleep",
      ].join("\n"),
      color: RED,
    },
    {
      title: "last checkpoint",
      description: [
        "what’s the smallest clean finish you can do?",
        "",
        "do that",
        "then stop ✨",
      ].join("\n"),
      color: RED,
    },
  ],

  // ===================== WATER =====================
  water: [
    {
      title: "wait",
      description: [
        "have you had water yet 🥺",
        "",
        "just a little bit",
        "then you can go back to cooking",
      ].join("\n"),
      color: GREEN,
    },
    {
      title: "quick thing 💧",
      description: [
        "go drink some water real quick",
        "",
        "i don’t want your brain running on fumes",
      ].join("\n"),
      color: GREEN,
    },
    {
      title: "tiny reset moment 🫶",
      description: [
        "stand up",
        "sip something",
        "",
        "come back sharper",
      ].join("\n"),
      color: GREEN,
    },
    {
      title: "just checking…",
      description: [
        "are we hydrated",
        "or are we being dramatic again 😭",
      ].join("\n"),
      color: GREEN,
    },
    {
      title: "listen",
      description: [
        "you’ve been locked in",
        "",
        "please hydrate a little",
        "i like you alive and functional 😌",
      ].join("\n"),
      color: GREEN,
    },
    {
      title: "potion time",
      description: [
        "sip sip",
        "",
        "it’s literally free focus",
        "why would we refuse free focus",
      ].join("\n"),
      color: GREEN,
    },
    {
      title: "be so fr",
      description: [
        "drink water",
        "",
        "like right now",
        "and then you can continue being scary productive",
      ].join("\n"),
      color: GREEN,
    },
    {
      title: "okay okay",
      description: [
        "one glass",
        "",
        "then back to whatever mastermind plan you’re doing 🤍",
      ].join("\n"),
      color: GREEN,
    },
  ],

  // ===================== BREAK =====================
  break: [
    {
      title: "pause for a sec",
      description: [
        "what are we actually trying to do right now",
        "",
        "like… really",
      ].join("\n"),
      color: BLURPLE,
    },
    {
      title: "zoom out with me 🫶",
      description: [
        "does this move the needle",
        "or just feel productive",
      ].join("\n"),
      color: BLURPLE,
    },
    {
      title: "i love the intensity",
      description: [
        "but let’s aim it properly",
        "",
        "what’s the next real move 🤍",
      ].join("\n"),
      color: BLURPLE,
    },
    {
      title: "tiny clarity check",
      description: [
        "if someone asked what you’re doing",
        "could you explain it cleanly",
      ].join("\n"),
      color: BLURPLE,
    },
    {
      title: "okay dramatic zoom out moment",
      description: [
        "what actually matters in this hour",
        "",
        "do that",
      ].join("\n"),
      color: BLURPLE,
    },
    {
      title: "quick reset",
      description: [
        "unclench jaw",
        "shoulders down",
        "",
        "choose the next move deliberately 😌",
      ].join("\n"),
      color: BLURPLE,
    },
    {
      title: "be honest 😭",
      description: [
        "is this the highest leverage thing",
        "",
        "or are we just spiraling stylishly",
      ].join("\n"),
      color: BLURPLE,
    },
    {
      title: "you’re powerful when you lock in",
      description: [
        "just make sure it’s pointed at the right thing",
        "",
        "i’m rooting for you 🫶",
      ].join("\n"),
      color: BLURPLE,
    },
  ],
};

export function pickWeighted<T extends { weight?: number }>(items: T[]): T {
  if (items.length === 0) throw new Error("pickWeighted: empty array");
  const total = items.reduce((sum, it) => sum + (it.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight ?? 1;
    if (r <= 0) return it;
  }
  return items[items.length - 1]!;
}