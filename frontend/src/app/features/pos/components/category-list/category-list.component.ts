import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CategoryDto } from '../../models/pos.models';

@Component({
  selector: 'app-pos-category-list',
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryListComponent {
  readonly categories = input.required<CategoryDto[]>();
  readonly selectedCategoryId = input<string | null>(null);
  readonly selectCategory = output<string | null>();
}
