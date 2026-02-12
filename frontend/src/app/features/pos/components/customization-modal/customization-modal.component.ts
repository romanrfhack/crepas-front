import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ExtraDto, OptionItemDto, ProductDto, SelectionGroupDto } from '../../models/pos.models';

export interface ProductCustomizationResult {
  selections: { groupKey: string; optionItemId: string; optionItemName: string }[];
  extras: { extraId: string; quantity: number; extraName: string; unitPrice: number }[];
}

@Component({
  selector: 'app-pos-customization-modal',
  templateUrl: './customization-modal.component.html',
  styleUrl: './customization-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomizationModalComponent {
  readonly product = input.required<ProductDto>();
  readonly groups = input.required<SelectionGroupDto[]>();
  readonly optionItems = input.required<OptionItemDto[]>();
  readonly extras = input.required<ExtraDto[]>();

  readonly cancelAction = output<void>();
  readonly confirm = output<ProductCustomizationResult>();

  readonly selectedByGroup = signal<Record<string, string[]>>({});
  readonly extraQty = signal<Record<string, number>>({});

  readonly sortedGroups = computed(() => [...this.groups()].sort((a, b) => a.sortOrder - b.sortOrder));


  isSelected(groupKey: string, optionItemId: string) {
    return (this.selectedByGroup()[groupKey] ?? []).includes(optionItemId);
  }

  readExtraQuantity(extraId: string) {
    return this.extraQty()[extraId] ?? 0;
  }
  optionsForGroup(group: SelectionGroupDto) {
    return this.optionItems()
      .filter((item) => item.optionSetId === group.optionSetId && item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  toggleSelection(group: SelectionGroupDto, optionItem: OptionItemDto) {
    this.selectedByGroup.update((state) => {
      const current = state[group.key] ?? [];
      const exists = current.includes(optionItem.id);
      const next = group.selectionMode === 0
        ? (exists ? [] : [optionItem.id])
        : (exists ? current.filter((id) => id !== optionItem.id) : [...current, optionItem.id]);
      return { ...state, [group.key]: next };
    });
  }

  changeExtraQuantity(extraId: string, delta: number) {
    this.extraQty.update((state) => {
      const current = state[extraId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...state, [extraId]: next };
    });
  }

  canConfirm() {
    const state = this.selectedByGroup();
    return this.sortedGroups().every((group) => {
      const size = (state[group.key] ?? []).length;
      return size >= group.minSelections && size <= group.maxSelections;
    });
  }

  submit() {
    if (!this.canConfirm()) {
      return;
    }

    const optionLookup = new Map(this.optionItems().map((item) => [item.id, item]));
    const selections = Object.entries(this.selectedByGroup()).flatMap(([groupKey, selectedIds]) =>
      selectedIds.map((optionItemId) => ({
        groupKey,
        optionItemId,
        optionItemName: optionLookup.get(optionItemId)?.name ?? optionItemId,
      })),
    );

    const extrasLookup = new Map(this.extras().map((extra) => [extra.id, extra]));
    const extras = Object.entries(this.extraQty())
      .filter(([, qty]) => qty > 0)
      .map(([extraId, quantity]) => {
        const extra = extrasLookup.get(extraId);
        return {
          extraId,
          quantity,
          extraName: extra?.name ?? extraId,
          unitPrice: extra?.price ?? 0,
        };
      });

    this.confirm.emit({ selections, extras });
  }
}
