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

  it('should allow overpayment with cash and show change', () => {
    const lineId = component.paymentLines()[0].id;

    component.updateMethod(lineId, 'Cash');
    component.updateAmount(lineId, 100);

    expect(component.changeAmount()).toBe(20);
    expect(component.canSubmit()).toBe(true);
    expect(component.isShort()).toBe(false);
  });

  it('invalidates submit when cash payment is insufficient', () => {
    const firstLineId = component.paymentLines()[0].id;

    component.updateMethod(firstLineId, 'Cash');
    component.updateAmount(firstLineId, 60);

    expect(component.isShort()).toBe(true);
    expect(component.hasDifference()).toBe(true);
    expect(component.canSubmit()).toBe(false);
  });

  it('requires exact sum when there is no cash method', () => {
    const firstLineId = component.paymentLines()[0].id;

    component.updateMethod(firstLineId, 'Card');
    component.updateAmount(firstLineId, 90);
    component.updateReference(firstLineId, 'AUTH-123');

    expect(component.hasCash()).toBe(false);
    expect(component.canSubmit()).toBe(false);
  });

  it('requires references for card and transfer payments', () => {
    const firstLineId = component.paymentLines()[0].id;

    component.updateMethod(firstLineId, 'Card');
    component.updateAmount(firstLineId, 80);

    expect(component.hasInvalidReference()).toBe(true);
    expect(component.canSubmit()).toBe(false);

    component.updateReference(firstLineId, 'AUTH-123');

    expect(component.hasInvalidReference()).toBe(false);
    expect(component.canSubmit()).toBe(true);
  });

  it('allows exact mixed payments that include cash', () => {
    const firstLineId = component.paymentLines()[0].id;

    component.updateAmount(firstLineId, 30);
    component.addPaymentLine();

    const secondLine = component.paymentLines()[1];
    component.updateMethod(secondLine.id, 'Transfer');
    component.updateAmount(secondLine.id, 50);
    component.updateReference(secondLine.id, 'SPEI-REF-01');

    expect(component.paidTotal()).toBe(80);
    expect(component.changeAmount()).toBe(0);
    expect(component.canSubmit()).toBe(true);
  });

  it('does not allow adding payment lines when all methods are already used', () => {
    component.addPaymentLine();
    component.addPaymentLine();

    expect(component.paymentLines().length).toBe(3);

    component.addPaymentLine();

    expect(component.paymentLines().length).toBe(3);
  });

  it('does not allow updating a line to a method already used by another line', () => {
    component.addPaymentLine();

    const [firstLine, secondLine] = component.paymentLines();
    component.updateMethod(secondLine.id, 'Card');

    component.updateMethod(firstLine.id, 'Card');

    expect(component.paymentLines()[0].method).toBe('Cash');
    expect(component.paymentLines()[1].method).toBe('Card');
  });

  it('emits mixed payments with references only for non-cash methods', () => {
    let submitted: unknown;
    component.submitPayment.subscribe((payload) => {
      submitted = payload;
    });

    const firstLineId = component.paymentLines()[0].id;

    component.updateAmount(firstLineId, 30);
    component.addPaymentLine();

    const secondLine = component.paymentLines()[1];

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
