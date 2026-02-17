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
    this.round2(
      this.paymentLines().reduce((sum, line) => sum + this.sanitizeAmount(line.amount), 0),
    ),
  );
  readonly hasCash = computed(() => this.paymentLines().some((line) => line.method === 'Cash'));
  readonly isShort = computed(() => this.paidTotal() < this.total());
  readonly changeAmount = computed(() =>
    this.hasCash() && this.paidTotal() > this.total()
      ? this.round2(this.paidTotal() - this.total())
      : 0,
  );
  readonly difference = computed(() => this.round2(this.total() - this.paidTotal()));
  readonly hasDifference = computed(() => this.paidTotal() < this.total());
  readonly hasInvalidReference = computed(() =>
    this.paymentLines().some(
      (line) => (line.method === 'Card' || line.method === 'Transfer') && !line.reference.trim(),
    ),
  );
  readonly hasInvalidAmount = computed(() =>
    this.paymentLines().some((line) => this.sanitizeAmount(line.amount) <= 0),
  );
  readonly canSubmit = computed(() => {
    if (this.loading()) {
      return false;
    }

    if (this.hasInvalidReference()) {
      return false;
    }

    if (this.hasInvalidAmount()) {
      return false;
    }

    if (this.hasCash()) {
      return this.paidTotal() >= this.total();
    }

    return Math.abs(this.paidTotal() - this.total()) < 0.009;
  });

  getAvailableMethods(currentLineId: string | null): PaymentMethod[] {
    const usedMethods = this.paymentLines()
      .filter((line) => line.id !== currentLineId)
      .map((line) => line.method);
    const allMethods: PaymentMethod[] = ['Cash', 'Card', 'Transfer'];

    return allMethods.filter((method) => !usedMethods.includes(method));
  }

  addPaymentLine() {
    const availableMethods = this.getAvailableMethods(null);
    if (availableMethods.length === 0) {
      return;
    }

    this.paymentLines.update((lines) => [
      ...lines,
      { id: crypto.randomUUID(), method: availableMethods[0], amount: 0, reference: '' },
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
    const isMethodUsed = this.paymentLines().some(
      (line) => line.id !== lineId && line.method === method,
    );
    if (isMethodUsed) {
      return;
    }

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
