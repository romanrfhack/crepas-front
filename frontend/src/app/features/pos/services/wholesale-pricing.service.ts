import { Injectable } from '@angular/core';
import {
  ProductWholesaleMode,
  ProductWholesaleOverrideDto,
  TenantWholesalePolicyDto,
  WholesaleTierDto,
} from '../models/pos.models';

export interface WholesalePricingInput {
  qty: number;
  basePrice: number;
  policy: TenantWholesalePolicyDto | null;
  override: ProductWholesaleOverrideDto | null;
}

export interface WholesalePricingResult {
  appliedUnitPrice: number;
  tierLabel: string | null;
  tierApplied: WholesaleTierDto | null;
}

@Injectable({ providedIn: 'root' })
export class WholesalePricingService {
  quote(input: WholesalePricingInput): WholesalePricingResult {
    const normalizedQty = this.normalizeNumber(input.qty);
    const normalizedPrice = this.round2(this.normalizeNumber(input.basePrice));
    if (normalizedQty <= 0) {
      return {
        appliedUnitPrice: normalizedPrice,
        tierLabel: null,
        tierApplied: null,
      };
    }

    const mode: ProductWholesaleMode = input.override?.mode ?? 'UseTenantDefault';
    if (mode === 'Disabled') {
      return {
        appliedUnitPrice: normalizedPrice,
        tierLabel: null,
        tierApplied: null,
      };
    }

    const tiers = this.resolveTiers(input.policy, input.override, mode);
    const tierApplied = this.selectTier(tiers, normalizedQty);
    if (!tierApplied) {
      return {
        appliedUnitPrice: normalizedPrice,
        tierLabel: null,
        tierApplied: null,
      };
    }

    const appliedUnitPrice =
      tierApplied.discountType === 'Percent'
        ? this.round2(normalizedPrice * (1 - tierApplied.discountValue / 100))
        : this.round2(tierApplied.discountValue);

    return {
      appliedUnitPrice,
      tierLabel: this.toTierLabel(tierApplied),
      tierApplied,
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
      return `≥${tier.minQty}: -${this.round2(tier.discountValue)}%`;
    }

    return `≥${tier.minQty}: $${this.round2(tier.discountValue).toFixed(2)} c/u`;
  }

  private normalizeNumber(value: number) {
    return Number.isFinite(value) ? value : 0;
  }

  private round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
