import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CreatePaymentRequestDto, PaymentMethod } from '../../models/pos.models';

interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference: string;
}

export interface PaymentSubmitEvent {
  payments: CreatePaymentRequestDto[];
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

  readonly paymentLines = signal<PaymentLine[]>([
    { id: crypto.randomUUID(), method: 'Cash', amount: 0, reference: '' },
  ]);

  readonly paidTotal = computed(() =>
    this.round2(this.paymentLines().reduce((sum, line) => sum + this.sanitizeAmount(line.amount), 0)),
  );
  readonly difference = computed(() => this.round2(this.total() - this.paidTotal()));
  readonly hasDifference = computed(() => Math.abs(this.difference()) > 0.009);
  readonly hasInvalidReference = computed(() =>
    this.paymentLines().some(
      (line) => (line.method === 'Card' || line.method === 'Transfer') && !line.reference.trim(),
    ),
  );
  readonly hasInvalidAmount = computed(() =>
    this.paymentLines().some((line) => this.sanitizeAmount(line.amount) <= 0),
  );
  readonly canSubmit = computed(
    () => !this.loading() && !this.hasDifference() && !this.hasInvalidReference() && !this.hasInvalidAmount(),
  );

  addPaymentLine() {
    this.paymentLines.update((lines) => [
      ...lines,
      { id: crypto.randomUUID(), method: 'Cash', amount: 0, reference: '' },
    ]);
  }

  removePaymentLine(lineId: string) {
    this.paymentLines.update((lines) => {
      if (lines.length <= 1) {
        return lines;
      }

      return lines.filter((line) => line.id !== lineId);
    });
  }

  updateMethod(lineId: string, method: PaymentMethod) {
    this.paymentLines.update((lines) =>
      lines.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        return {
          ...line,
          method,
          reference: method === 'Cash' ? '' : line.reference,
        };
      }),
    );
  }

  updateAmount(lineId: string, amount: number) {
    const nextAmount = this.sanitizeAmount(amount);
    this.paymentLines.update((lines) =>
      lines.map((line) => (line.id === lineId ? { ...line, amount: nextAmount } : line)),
    );
  }

  updateReference(lineId: string, reference: string) {
    this.paymentLines.update((lines) =>
      lines.map((line) => (line.id === lineId ? { ...line, reference } : line)),
    );
  }

  confirmPayment() {
    if (!this.canSubmit()) {
      return;
    }

    this.submitPayment.emit({
      payments: this.paymentLines().map((line) => {
        const reference = line.reference.trim();
        return {
          method: line.method,
          amount: this.round2(this.sanitizeAmount(line.amount)),
          reference: line.method === 'Cash' ? null : reference || null,
        };
      }),
    });
  }

  private sanitizeAmount(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }

    return value;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
