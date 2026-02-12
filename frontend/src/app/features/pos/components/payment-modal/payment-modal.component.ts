import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CreatePaymentRequestDto, PaymentMethod, PaymentUiState } from '../../models/pos.models';

export type PaymentSubmitEvent = CreatePaymentRequestDto;

@Component({
  selector: 'app-pos-payment-modal',
  templateUrl: './payment-modal.component.html',
  styleUrl: './payment-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentModalComponent {
  readonly total = input.required<number>();
  readonly loading = input<boolean>(false);
  readonly submitPayment = output<PaymentSubmitEvent>();
  readonly cancelAction = output<void>();

  readonly uiState = signal<PaymentUiState>({
    method: 'Cash',
    reference: '',
    receivedAmount: 0,
    change: 0,
  });

  readonly method = computed(() => this.uiState().method);
  readonly reference = computed(() => this.uiState().reference);
  readonly receivedAmount = computed(() => this.uiState().receivedAmount ?? 0);

  readonly changeAmount = computed(() => {
    const { method, receivedAmount } = this.uiState();
    if (method !== 'Cash') {
      return 0;
    }

    return Math.max(0, (receivedAmount ?? 0) - this.total());
  });

  readonly insufficientCash = computed(() => this.method() === 'Cash' && this.receivedAmount() < this.total());

  selectMethod(method: PaymentMethod) {
    this.uiState.update((current) => ({
      ...current,
      method,
      receivedAmount: method === 'Cash' ? current.receivedAmount ?? 0 : undefined,
      change: method === 'Cash' ? this.changeAmount() : undefined,
    }));
  }

  updateReceivedAmount(amount: number) {
    const nextAmount = Number.isFinite(amount) ? amount : 0;
    this.uiState.update((current) => ({
      ...current,
      receivedAmount: nextAmount,
      change: Math.max(0, nextAmount - this.total()),
    }));
  }

  updateReference(reference: string) {
    this.uiState.update((current) => ({ ...current, reference }));
  }

  confirmPayment() {
    if (this.insufficientCash()) {
      return;
    }

    const total = this.total();
    const reference = this.reference().trim();

    this.submitPayment.emit({
      method: this.method(),
      amount: total,
      reference: reference.length > 0 ? reference : null,
    });
  }
}
