export type OwnerWellbeingKind = "late" | "water" | "break";

export type WellbeingLine = {
  message: string;
  weight?: number;
};

export const OWNER_WELLBEING_LINES: Record<
  OwnerWellbeingKind,
  WellbeingLine[]
> = {
  // ===================== LATE =====================
  late: [
    {
      message:
        "hey… it's getting late. don't let tonight steal from tomorrow 🤍 one more thing then rest, okay?",
    },
    {
      message:
        'okay bestie — the "one more thing" trap is real 😭 wrap up something small and then log off. future you will thank you!',
    },
    {
      message:
        "psst — you've done a lot today. save your progress, close the tabs, and get some sleep ✨",
    },
    {
      message:
        "quick one: pick one tiny thing to finish or just… stop. either way you win 🫶 then rest!",
    },
    {
      message:
        "one more save point, then you log off like the legend you are. deal? 🤝 get some sleep!",
    },
    {
      message:
        "it's getting late — your brain needs rest to recharge for tomorrow. wrap up and sleep well 😌",
    },
    {
      message:
        "okay commander 🫡 tomorrow-you needs you rested. call it a night and come back stronger!",
    },
    {
      message:
        "whatever you're doing can wait. you've got this tomorrow — go sleep! 🤍",
    },
  ],

  // ===================== WATER =====================
  water: [
    {
      message:
        "wait — have you had water yet 🥺 just a little sip, then back to whatever you're crushing!",
    },
    {
      message:
        "go drink some water real quick 💧 i don't want your brain running on fumes!",
    },
    {
      message:
        "stand up, grab a sip of something, then come back. you'll feel a bit sharper 🫶",
    },
    {
      message:
        "are we hydrated or are we being dramatic again 😭 go drink some water!",
    },
    {
      message:
        "you've been locked in — please hydrate a little. i like you alive and functional 😌",
    },
    {
      message:
        "hiiii!! potion time 🧪 sip sip! it's literally free focus. why would we refuse free focus?",
    },
    {
      message:
        "...drink water. like right now. then you can go back to being scary productive!",
    },
    {
      message:
        "one glass of water :droplet:  then back to whatever mastermind plan you're doing :3",
    },
    {
      message: "yo... your mana bar's looking low :skull: grab some water and top it off!",
    },
  ],

  // ===================== BREAK =====================
  break: [
    {
      message:
        "HELLO!! pause for a sec — unclench your jaw, shoulders down. take a breath. you're doing great <3",
    },
    {
      message:
        "heyy, step away from the screen for like two minutes. stretch a little. your body will thank you!",
    },
    {
      message:
        "i love the intensity, but your eyes and brain need a tiny break. look at something that isn't a screen for a sec 😌",
    },
    {
      message:
        "you've been going hard — take a short break. walk around, stare at a wall, whatever. then back to it!",
    },
    {
      message:
        "breathe. stretch. maybe get a snack. you'll come back sharper, i promise ✨",
    },
    {
      message:
        "be honest 😭 when did you last look away from the screen? do it now — even 60 seconds helps!",
    },
    {
      message:
        "you're doing great, but even heroes need a rest. take a tiny break and come back when you're ready 🤍",
    },
    {
      message:
        "pause menu moment — hit pause for a bit. grab water, stretch, breathe. the game will still be here 🎮",
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
