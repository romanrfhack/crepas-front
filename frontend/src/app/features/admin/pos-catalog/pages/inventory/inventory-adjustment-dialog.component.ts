import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { InventoryAdjustmentReason, InventoryBalanceRowDto } from '../../models/pos-catalog.models';

@Component({
  selector: 'app-inventory-adjustment-dialog',
  imports: [ReactiveFormsModule],
  template: `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="inv-adjust-title" data-testid="inventory-adjustment-dialog">
      <h4 id="inv-adjust-title">Ajustar inventario</h4>
      <p data-testid="inventory-adjustment-item">{{ row()?.name }} ({{ row()?.itemType }})</p>
      <label>Operación
        <select [formControl]="operationTypeControl" data-testid="inventory-adjustment-operation-type">
          <option value="Delta">Delta</option>
          <option value="Set">Set</option>
        </select>
      </label>
      <label>Cantidad
        <input type="number" step="0.001" [formControl]="quantityControl" data-testid="inventory-adjustment-quantity" />
      </label>
      <label>Motivo
        <select [formControl]="reasonCodeControl" data-testid="inventory-adjustment-reason">
          @for (reason of reasons; track reason) {
            <option [value]="reason">{{ reason }}</option>
          }
        </select>
      </label>
      <label>Referencia <input [formControl]="referenceControl" data-testid="inventory-adjustment-reference" /></label>
      <label>Nota <input [formControl]="noteControl" data-testid="inventory-adjustment-note" /></label>
      <p data-testid="inventory-adjustment-preview-before">Antes: {{ qtyBefore() }}</p>
      <p data-testid="inventory-adjustment-preview-delta">Delta: {{ qtyDelta() }}</p>
      <p data-testid="inventory-adjustment-preview-after">Después: {{ qtyAfter() }}</p>
      @if (validationError(); as error) {
        <p class="error" role="alert" data-testid="inventory-adjustment-validation-error">{{ error }}</p>
      }
      <div>
        <button type="button" (click)="dismissed.emit()" data-testid="inventory-adjustment-cancel">Cancelar</button>
        <button type="button" (click)="onConfirm()" data-testid="inventory-adjustment-confirm">Confirmar</button>
      </div>
    </div>
  `,
  styles: `.dialog { border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; background: white; display: grid; gap: .5rem; } .error { color: #b91c1c; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryAdjustmentDialogComponent {
  readonly row = input<InventoryBalanceRowDto | null>(null);
  readonly storeId = input('');
  readonly confirm = output<{ operationType: 'Delta' | 'Set'; quantity: number; reasonCode: InventoryAdjustmentReason; reference: string | null; note: string | null }>();
  readonly dismissed = output<void>();

  readonly reasons: InventoryAdjustmentReason[] = ['InitialLoad', 'Purchase', 'Return', 'Waste', 'Damage', 'Correction', 'TransferIn', 'TransferOut', 'ManualCount', 'SaleConsumption', 'VoidReversal'];
  readonly operationTypeControl = new FormControl<'Delta' | 'Set'>('Delta', { nonNullable: true });
  readonly quantityControl = new FormControl(0, { nonNullable: true, validators: [Validators.required] });
  readonly reasonCodeControl = new FormControl<InventoryAdjustmentReason>('Correction', { nonNullable: true, validators: [Validators.required] });
  readonly referenceControl = new FormControl('', { nonNullable: true });
  readonly noteControl = new FormControl('', { nonNullable: true });

  private readonly operationType = toSignal(this.operationTypeControl.valueChanges.pipe(startWith(this.operationTypeControl.value)), { initialValue: this.operationTypeControl.value });
  private readonly quantity = toSignal(this.quantityControl.valueChanges.pipe(startWith(this.quantityControl.value)), { initialValue: this.quantityControl.value });
  private readonly reasonCode = toSignal(this.reasonCodeControl.valueChanges.pipe(startWith(this.reasonCodeControl.value)), { initialValue: this.reasonCodeControl.value });

  readonly qtyBefore = computed(() => this.row()?.onHandQty ?? 0);
  readonly qtyDelta = computed(() => this.operationType() === 'Delta' ? this.quantity() : this.quantity() - this.qtyBefore());
  readonly qtyAfter = computed(() => this.operationType() === 'Delta' ? this.qtyBefore() + this.quantity() : this.quantity());
  readonly validationError = computed(() => {
    if (!this.reasonCode().trim()) return 'Motivo obligatorio.';
    if (this.operationType() === 'Delta' && this.quantity() === 0) return 'Delta debe ser distinto de cero.';
    if (this.qtyAfter() < 0) return 'El resultado no puede ser negativo.';
    return '';
  });

  onConfirm() {
    if (this.validationError()) {
      return;
    }

    this.confirm.emit({
      operationType: this.operationType(),
      quantity: Math.round(this.quantity() * 1000) / 1000,
      reasonCode: this.reasonCode(),
      reference: this.referenceControl.value.trim() || null,
      note: this.noteControl.value.trim() || null,
    });
  }
}
