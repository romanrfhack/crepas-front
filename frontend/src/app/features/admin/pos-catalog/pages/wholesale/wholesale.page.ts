import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  UpsertTenantWholesalePolicyRequest,
  WholesaleDiscountType,
  WholesaleTierDto,
} from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-wholesale-page',
  imports: [ReactiveFormsModule],
  template: `
    <section>
      <h2>Mayoreo</h2>
      <p>Configura política default por tenant.</p>

      @if (errorMessage()) {
        <p role="alert">{{ errorMessage() }}</p>
      }

      <form [formGroup]="form" (submit)="onSave($event)">
        <label>
          <input type="checkbox" formControlName="isEnabled" /> Activar mayoreo
        </label>

        <label>
          Nombre
          <input type="text" formControlName="name" />
        </label>

        <h3>Tiers</h3>
        <button type="button" (click)="addTier()">Agregar tier</button>

        <div formArrayName="tiers">
          @for (tier of tiers.controls; track $index) {
            <div [formGroupName]="$index" style="display:flex; gap:.5rem; margin:.4rem 0;">
              <input type="number" formControlName="minQty" min="1" step="1" aria-label="Cantidad mínima" />
              <select formControlName="discountType" aria-label="Tipo descuento">
                <option value="Percent">Porcentaje</option>
                <option value="FixedUnitPrice">Precio fijo</option>
              </select>
              <input type="number" formControlName="discountValue" min="0" step="0.01" aria-label="Valor descuento" />
              <button type="button" (click)="removeTier($index)">Eliminar</button>
            </div>
          }
        </div>

        <button type="submit" [disabled]="form.invalid">Guardar política</button>
      </form>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WholesalePage {
  private readonly api = inject(PosCatalogApiService);
  private readonly fb = inject(FormBuilder);

  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    isEnabled: [false],
    name: ['Política default', [Validators.required]],
    tiers: this.fb.array([this.createTierForm()]),
  });

  get tiers() {
    return this.form.controls.tiers as FormArray;
  }

  constructor() {
    void this.load();
  }

  addTier() {
    this.tiers.push(this.createTierForm());
  }

  removeTier(index: number) {
    this.tiers.removeAt(index);
  }

  async onSave(event: Event) {
    event.preventDefault();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();
    const tiers = this.normalizeTiers(payload.tiers as WholesaleTierDto[]);
    if (!this.validateTiers(tiers)) {
      return;
    }

    const request: UpsertTenantWholesalePolicyRequest = {
      isEnabled: payload.isEnabled,
      name: payload.name,
      tiers,
    };

    await this.api.upsertTenantWholesalePolicy(request);
  }

  private async load() {
    try {
      const policy = await this.api.getTenantWholesalePolicy();
      this.form.patchValue({ isEnabled: policy.isEnabled, name: policy.name });
      this.tiers.clear();
      const tiers: WholesaleTierDto[] = policy.tiers.length
        ? policy.tiers
        : [{ minQty: 10, discountType: 'Percent', discountValue: 10 }];
      tiers.forEach((tier) => {
        this.tiers.push(this.createTierForm(tier));
      });
    } catch {
      this.errorMessage.set('No se pudo cargar política de mayoreo.');
    }
  }

  private createTierForm(tier?: WholesaleTierDto) {
    return this.fb.nonNullable.group({
      minQty: [tier?.minQty ?? 10, [Validators.required, Validators.min(1)]],
      discountType: [tier?.discountType ?? ('Percent' satisfies WholesaleDiscountType), [Validators.required]],
      discountValue: [tier?.discountValue ?? 10, [Validators.required, Validators.min(0)]],
    });
  }

  private normalizeTiers(tiers: WholesaleTierDto[]) {
    return [...tiers].sort((a, b) => a.minQty - b.minQty);
  }

  private validateTiers(tiers: WholesaleTierDto[]) {
    const seen = new Set<number>();
    for (const tier of tiers) {
      if (seen.has(tier.minQty)) {
        this.errorMessage.set('No puede haber minQty duplicado en tiers.');
        return false;
      }

      if (tier.discountType === 'Percent' && (tier.discountValue <= 0 || tier.discountValue >= 100)) {
        this.errorMessage.set('Porcentaje debe ser >0 y <100.');
        return false;
      }

      if (tier.discountType === 'FixedUnitPrice' && tier.discountValue < 0) {
        this.errorMessage.set('Precio fijo debe ser >= 0.');
        return false;
      }

      seen.add(tier.minQty);
    }

    this.errorMessage.set(null);
    return true;
  }
}
