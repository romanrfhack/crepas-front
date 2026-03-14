import { Injectable } from '@angular/core';
import {
  ProductWholesaleMode,
  ProductWholesaleOverrideDto,
  TenantWholesalePolicyDto,
  WholesaleAppliedSnapshotDto,
  WholesaleTierDto,
} from '../models/pos.models';
import { roundMoney } from '../utils/pricing-rounding';

export interface WholesalePricingInput {
  qty: number;
  basePrice: number;
  policy: TenantWholesalePolicyDto | null;
  override: ProductWholesaleOverrideDto | null;
}

export interface WholesalePricingResult {
  baseUnitPrice: number;
  appliedUnitPrice: number;
  tierLabel: string | null;
  tierApplied: WholesaleTierDto | null;
  wholesale: WholesaleAppliedSnapshotDto;
}

@Injectable({ providedIn: 'root' })
export class WholesalePricingService {
  quote(input: WholesalePricingInput): WholesalePricingResult {
    const normalizedQty = this.normalizeNumber(input.qty);
    const normalizedPrice = roundMoney(this.normalizeNumber(input.basePrice));
    if (normalizedQty <= 0) {
      return this.baseResult(normalizedPrice);
    }

    const mode: ProductWholesaleMode = input.override?.mode ?? 'UseTenantDefault';
    if (mode === 'Disabled') {
      return this.baseResult(normalizedPrice);
    }

    const source: 'tenant' | 'product' = mode === 'CustomTiers' ? 'product' : 'tenant';
    const tiers = this.resolveTiers(input.policy, input.override, mode);
    const tierApplied = this.selectTier(tiers, normalizedQty);
    if (!tierApplied) {
      return this.baseResult(normalizedPrice);
    }

    const appliedUnitPrice =
      tierApplied.discountType === 'Percent'
        ? roundMoney(normalizedPrice * (1 - tierApplied.discountValue / 100))
        : roundMoney(tierApplied.discountValue);

    return {
      baseUnitPrice: normalizedPrice,
      appliedUnitPrice,
      tierLabel: this.toTierLabel(tierApplied),
      tierApplied,
      wholesale: {
        isApplied: true,
        minQty: tierApplied.minQty,
        discountType: tierApplied.discountType,
        discountValue: tierApplied.discountValue,
        source,
      },
    };
  }

  private baseResult(baseUnitPrice: number): WholesalePricingResult {
    return {
      baseUnitPrice,
      appliedUnitPrice: baseUnitPrice,
      tierLabel: null,
      tierApplied: null,
      wholesale: {
        isApplied: false,
        minQty: null,
        discountType: null,
        discountValue: null,
        source: null,
      },
    };
  }

  private resolveTiers(
    policy: TenantWholesalePolicyDto | null,
    override: ProductWholesaleOverrideDto | null,
    mode: ProductWholesaleMode,
  ) {
    if (mode === 'CustomTiers') {
      return this.normalizeTiers(override?.tiers ?? []);
    }

    if (!policy?.isEnabled) {
      return [];
    }

    return this.normalizeTiers(policy.tiers);
  }

  private normalizeTiers(tiers: WholesaleTierDto[]) {
    return [...tiers]
      .map((tier) => ({
        minQty: this.normalizeNumber(tier.minQty),
        discountType: tier.discountType,
        discountValue: this.normalizeNumber(tier.discountValue),
      }))
      .filter((tier) => tier.minQty > 0)
      .sort((a, b) => a.minQty - b.minQty);
  }

  private selectTier(tiers: WholesaleTierDto[], qty: number) {
    const applicable = tiers.filter((tier) => qty >= tier.minQty);
    return applicable.length ? applicable[applicable.length - 1] : null;
  }

  private toTierLabel(tier: WholesaleTierDto) {
    if (tier.discountType === 'Percent') {
      return `≥${tier.minQty}: -${roundMoney(tier.discountValue)}%`;
    }

    return `≥${tier.minQty}: $${roundMoney(tier.discountValue).toFixed(2)} c/u`;
  }

  private normalizeNumber(value: number) {
    return Number.isFinite(value) ? value : 0;
  }
}
