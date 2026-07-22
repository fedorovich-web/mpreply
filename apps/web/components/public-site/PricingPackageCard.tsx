import Link from "next/link";

import type { PublicPricingPlan } from "../../lib/public-pricing";
import { MarketingGlyph } from "./MarketingGlyph";

type PricingPackageCardProps = {
  plan: PublicPricingPlan;
};

export function PricingPackageCard({ plan }: PricingPackageCardProps) {
  return (
    <article className={`pricing-pack-card pricing-pack-card-v89 pricing-pack-card-v90${plan.highlighted ? " is-highlighted" : ""}`}>
      <div className="pricing-pack-card__topline">
        <MarketingGlyph variant={plan.icon} />
        {plan.highlighted ? <span className="pricing-pack-card__badge">Популярный выбор</span> : null}
      </div>

      <div className="pricing-pack-card__heading">
        <h3>{plan.name}</h3>
        <p>{plan.audience}</p>
      </div>

      <p className="pricing-pack-card__volume">{plan.answers}</p>

      <div className="pricing-pack-card__price">
        <strong>{plan.price}</strong>
        <span>{plan.currency}</span>
      </div>

      <p className="pricing-pack-card__unit">{plan.pricePerAnswer}</p>
      <p className="pricing-pack-card__description">{plan.description}</p>

      <ul className="pricing-pack-card__features">
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <Link
        className="button pricing-pack-card__action"
        href={`/contacts?package=${plan.key}`}
        aria-label={`Выбрать пакет ${plan.name}: ${plan.answers}`}
      >
        Выбрать пакет
      </Link>
    </article>
  );
}
