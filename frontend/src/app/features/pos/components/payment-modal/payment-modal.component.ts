import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PaymentMethod } from '../../models/pos.models';

export interface PaymentSubmitEvent {
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  receivedAmount: number | null;
}

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

  readonly method = signal<PaymentMethod>('Cash');
  readonly reference = signal('');
  readonly receivedAmount = signal<number>(0);

  readonly changeAmount = computed(() => {
    if (this.method() !== 'Cash') {
      return 0;
    }

    return Math.max(0, this.receivedAmount() - this.total());
  });

  confirmPayment() {
    const total = this.total();
    const amount = this.method() === 'Cash' ? Math.max(total, this.receivedAmount()) : total;
    const reference = this.reference().trim();
    this.submitPayment.emit({
      method: this.method(),
      amount,
      reference: reference.length > 0 ? reference : null,
      receivedAmount: this.method() === 'Cash' ? this.receivedAmount() : null,
    });
  }
}
