import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ProductDto } from '../../models/pos.models';

@Component({
  selector: 'app-pos-product-grid',
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGridComponent {
  readonly products = input.required<ProductDto[]>();
  readonly addProduct = output<ProductDto>();

  onProductClick(product: ProductDto) {
    if (!product.isAvailable) {
      return;
    }

    this.addProduct.emit(product);
  }
}
