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

  it('should emit total as amount for cash payments', () => {
    let submitted: unknown;
    component.submitPayment.subscribe((payload) => {
      submitted = payload;
    });

    component.updateReceivedAmount(200);
    component.confirmPayment();

    expect(submitted).toEqual({
      method: 'Cash',
      amount: 80,
      reference: null,
    });
    expect(component.changeAmount()).toBe(120);
  });

  it('should block cash confirmation when received amount is less than total', () => {
    let submitted: unknown;
    component.submitPayment.subscribe((payload) => {
      submitted = payload;
    });

    component.updateReceivedAmount(79.99);
    component.confirmPayment();

    expect(component.insufficientCash()).toBeTruthy();
    expect(submitted).toBeFalsy();
  });
});
