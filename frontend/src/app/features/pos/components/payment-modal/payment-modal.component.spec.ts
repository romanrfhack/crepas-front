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

  it('should emit mixed payments when totals match', () => {
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

  it('should require references for card and transfer payments', () => {
    const firstLineId = component.paymentLines()[0]?.id;
    component.updateMethod(firstLineId!, 'Card');
    component.updateAmount(firstLineId!, 80);

    expect(component.hasInvalidReference()).toBeTrue();
    expect(component.canSubmit()).toBeFalse();
  });
});
