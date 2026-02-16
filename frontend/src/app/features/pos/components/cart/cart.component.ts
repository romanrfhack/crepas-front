import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CartItem } from '../../models/pos.models';

@Component({
  selector: 'app-pos-cart',
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent {
  readonly items = input.required<CartItem[]>();
  readonly estimatedTotal = input.required<number>();
  readonly remove = output<string>();
  readonly decrease = output<string>();
  readonly increase = output<string>();
  readonly checkout = output<void>();
  readonly checkoutDisabled = input<boolean>(false);
  readonly checkoutTestId = input<string | null>(null);
}
