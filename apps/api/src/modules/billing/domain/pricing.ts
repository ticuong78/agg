import { TierCatalog, TopUpPacks, type BillingPeriod, type CheckoutProduct, type TopUpPack } from '@agg/contracts';
import { assert } from '../../../shared/domain/domain-error.js';

export const MAX_EXTRA_SEATS = 200;

export interface PricedProduct {
  product: CheckoutProduct;
  amount: number;
  description: string;
}

/** Domain service: what a product costs. The catalogue is the shared one, so the pricing page shows the same numbers. */
export function price(product: CheckoutProduct): PricedProduct {
  if (product.kind === 'TOPUP') {
    const pack = findPack(product.packId);
    return { product, amount: pack.price, description: `Gói ${pack.label}` };
  }
  const tier = TierCatalog[product.tier];
  const base = product.period === 'YEAR' ? tier.priceYearly : tier.priceMonthly;
  assert(base !== null && base > 0, 'checkout.not_for_sale', 'Gói này cần liên hệ để báo giá.');
  const extraSeats = product.tier === 'SCHOOL' ? Math.max(0, Math.floor(product.extraSeats ?? 0)) : 0;
  assert(extraSeats <= MAX_EXTRA_SEATS, 'checkout.too_many_seats', `Tối đa thêm ${MAX_EXTRA_SEATS} thành viên. Liên hệ để có gói lớn hơn.`);
  const seatPrice = (tier.extraSeatMonthly ?? 0) * extraSeats * months(product.period);
  // Yearly seats get the same "two months free" as the plan.
  const seats = product.period === 'YEAR' ? Math.round((seatPrice * 10) / 12) : seatPrice;
  const label = product.period === 'YEAR' ? '12 tháng' : '1 tháng';
  return {
    product: { ...product, extraSeats },
    amount: base + seats,
    description: `Gói ${tier.name} ${label}${extraSeats ? ` + ${extraSeats} thành viên` : ''}`,
  };
}

export function findPack(packId: string): TopUpPack {
  const pack = TopUpPacks.find((p) => p.id === packId);
  assert(pack, 'checkout.unknown_pack', 'Gói credit không tồn tại.');
  return pack;
}

export const months = (period: BillingPeriod): number => (period === 'YEAR' ? 12 : 1);
