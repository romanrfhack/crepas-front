import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentModalComponent } from './payment-modal.component';

describe('PaymentModalComponent', () => {
  let fixture: ComponentFixture<PaymentModalComponent>;
  let component: PaymentModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('total', 80);
    fixture.detectChanges();
  });

  it('invalidates submit when payment total does not match expected total', () => {
    const firstLineId = component.paymentLines()[0]?.id;
    expect(firstLineId).toBeTruthy();

    component.updateAmount(firstLineId!, 60);

    expect(component.hasDifference()).toBe(true);
    expect(component.canSubmit()).toBe(false);
  });

  it('requires references for card and transfer payments', () => {
    const firstLineId = component.paymentLines()[0]?.id;
    expect(firstLineId).toBeTruthy();

    component.updateMethod(firstLineId!, 'Card');
    component.updateAmount(firstLineId!, 80);

    expect(component.hasInvalidReference()).toBe(true);
    expect(component.canSubmit()).toBe(false);

    component.updateReference(firstLineId!, 'AUTH-123');

    expect(component.hasInvalidReference()).toBe(false);
    expect(component.canSubmit()).toBe(true);
  });

  it('allows multiple payment lines and recalculates totals', () => {
    const firstLineId = component.paymentLines()[0]?.id;
    expect(firstLineId).toBeTruthy();

    component.updateAmount(firstLineId!, 30);
    component.addPaymentLine();

    const secondLine = component.paymentLines()[1];
    expect(secondLine).toBeTruthy();

    component.updateMethod(secondLine.id, 'Transfer');
    component.updateAmount(secondLine.id, 50);
    component.updateReference(secondLine.id, 'SPEI-REF-01');

    expect(component.paidTotal()).toBe(80);
    expect(component.difference()).toBe(0);
    expect(component.canSubmit()).toBe(true);
  });

  it('emits mixed payments with references only for non-cash methods', () => {
    let submitted: unknown;
    component.submitPayment.subscribe((payload) => {
      submitted = payload;
    });

    const firstLineId = component.paymentLines()[0]?.id;
    expect(firstLineId).toBeTruthy();

    component.updateAmount(firstLineId!, 30);
    component.addPaymentLine();

    const secondLine = component.paymentLines()[1];
    expect(secondLine).toBeTruthy();

    component.updateMethod(secondLine.id, 'Card');
    component.updateAmount(secondLine.id, 50);
    component.updateReference(secondLine.id, 'AUTH-123');
    component.confirmPayment();

    expect(submitted).toEqual({
      payments: [
        { method: 'Cash', amount: 30, reference: null },
        { method: 'Card', amount: 50, reference: 'AUTH-123' },
      ],
    });
  });
});
