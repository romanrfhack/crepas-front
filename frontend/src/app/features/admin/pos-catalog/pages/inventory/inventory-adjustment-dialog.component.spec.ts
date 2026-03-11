import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InventoryAdjustmentDialogComponent } from './inventory-adjustment-dialog.component';

describe('InventoryAdjustmentDialogComponent', () => {
  let fixture: ComponentFixture<InventoryAdjustmentDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [InventoryAdjustmentDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(InventoryAdjustmentDialogComponent);
    fixture.componentRef.setInput('row', {
      itemType: 'Product',
      itemId: 'product-1',
      name: 'Latte',
      sku: 'LAT-1',
      categoryName: 'Bebidas',
      isInventoryTracked: true,
      onHandQty: 5,
      balanceVersion: 'v1',
    });
    fixture.detectChanges();
  });

  it('calcula preview correctamente para delta', () => {
    fixture.componentInstance.operationTypeControl.setValue('Delta');
    fixture.componentInstance.quantityControl.setValue(-2);
    fixture.detectChanges();

    expect(fixture.componentInstance.qtyBefore()).toBe(5);
    expect(fixture.componentInstance.qtyDelta()).toBe(-2);
    expect(fixture.componentInstance.qtyAfter()).toBe(3);
  });

  it('valida delta no cero y no negativo', () => {
    fixture.componentInstance.operationTypeControl.setValue('Delta');
    fixture.componentInstance.quantityControl.setValue(0);
    expect(fixture.componentInstance.validationError()).toContain('Delta');

    fixture.componentInstance.quantityControl.setValue(-9);
    expect(fixture.componentInstance.validationError()).toContain('negativo');
  });
});
