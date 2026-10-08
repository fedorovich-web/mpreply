export const monthlyPlans = [
  { code: "start", replies: 300, priceRub: 1290 },
  { code: "team", replies: 800, priceRub: 3490 },
  { code: "business", replies: 1600, priceRub: 6990 },
] as const;

export const replyPacks = [
  { code: "extra-50", replies: 50, priceRub: 299 },
  { code: "extra-100", replies: 100, priceRub: 549 },
  { code: "extra-250", replies: 250, priceRub: 1290 },
  { code: "extra-500", replies: 500, priceRub: 2490 },
  { code: "extra-1000", replies: 1000, priceRub: 4790 },
  { code: "extra-2000", replies: 2000, priceRub: 9290 },
  { code: "extra-5000", replies: 5000, priceRub: 22490 },
  { code: "extra-10000", replies: 10000, priceRub: 43900 },
  { code: "extra-15000", replies: 15000, priceRub: 65400 },
  { code: "extra-20000", replies: 20000, priceRub: 86900 },
] as const;

type Pack = (typeof replyPacks)[number];

type PackSelection = {
  costRub: number;
  replies: number;
  packs: Pack[];
};

function cheapestPacks(requiredReplies: number): PackSelection {
  if (requiredReplies <= 0) return { costRub: 0, replies: 0, packs: [] };

  const requiredUnits = Math.ceil(requiredReplies / 50);
  const maxUnits = requiredUnits + 9;
  const best: Array<PackSelection | undefined> = Array(maxUnits + 1).fill(undefined);
  best[0] = { costRub: 0, replies: 0, packs: [] };

  for (let units = 1; units <= maxUnits; units += 1) {
    for (const pack of replyPacks) {
      const previousUnits = units - pack.replies / 50;
      const previous = previousUnits >= 0 ? best[previousUnits] : undefined;
      if (!previous) continue;
      const candidate: PackSelection = {
        costRub: previous.costRub + pack.priceRub,
        replies: previous.replies + pack.replies,
        packs: [...previous.packs, pack],
      };
      const current = best[units];
      if (!current || candidate.costRub < current.costRub) best[units] = candidate;
    }
  }

  const options = best.slice(requiredUnits).filter((option): option is PackSelection => Boolean(option));
  return options.reduce((cheapest, option) =>
    option.costRub < cheapest.costRub || (option.costRub === cheapest.costRub && option.replies < cheapest.replies)
      ? option
      : cheapest,
  );
}

export function estimateAddOnPurchase(requestedReplies: number): PackSelection {
  if (!Number.isSafeInteger(requestedReplies) || requestedReplies < 1 || requestedReplies > 20000) {
    throw new RangeError("requestedReplies must be an integer between 1 and 20000");
  }
  return cheapestPacks(requestedReplies);
}

export function estimateMonthlyPrice(monthlyReplies: number) {
  if (!Number.isSafeInteger(monthlyReplies) || monthlyReplies < 1 || monthlyReplies > 20000) {
    throw new RangeError("monthlyReplies must be an integer between 1 and 20000");
  }

  const options = monthlyPlans.map((plan) => {
    const addOns = cheapestPacks(Math.max(0, monthlyReplies - plan.replies));
    return {
      plan,
      addOns,
      totalRub: plan.priceRub + addOns.costRub,
      includedReplies: plan.replies + addOns.replies,
    };
  });

  return options.reduce((cheapest, option) =>
    option.totalRub < cheapest.totalRub ||
    (option.totalRub === cheapest.totalRub && option.includedReplies < cheapest.includedReplies)
      ? option
      : cheapest,
  );
}
