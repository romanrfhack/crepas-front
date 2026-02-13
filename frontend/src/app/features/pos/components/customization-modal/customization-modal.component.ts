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

  readonly sortedGroups = computed(() =>
    [...this.groups()].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  /** Retorna la cantidad de selecciones actuales para un grupo */
  selectedCountForGroup(groupKey: string): number {
    return (this.selectedByGroup()[groupKey] ?? []).length;
  }

  /** Verifica si una opción está seleccionada */
  isSelected(groupKey: string, optionItemId: string): boolean {
    return (this.selectedByGroup()[groupKey] ?? []).includes(optionItemId);
  }

  /** Lee la cantidad actual de un extra */
  readExtraQuantity(extraId: string): number {
    return this.extraQty()[extraId] ?? 0;
  }

  /** Filtra y ordena las opciones de un grupo */
  optionsForGroup(group: SelectionGroupDto): OptionItemDto[] {
    return this.optionItems()
      .filter((item) => item.optionSetId === group.optionSetId && item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Alterna la selección de una opción, respetando mínimos y máximos */
  toggleSelection(group: SelectionGroupDto, optionItem: OptionItemDto): void {
    this.selectedByGroup.update((state) => {
      const current = state[group.key] ?? [];
      const exists = current.includes(optionItem.id);
      let next: string[];

      if (group.selectionMode === 0) {
        // RADIO: selección única
        next = exists ? [] : [optionItem.id];
      } else {
        // CHECKBOX: selección múltiple con límite máximo
        if (exists) {
          // Si ya está seleccionado, lo quitamos
          next = current.filter((id) => id !== optionItem.id);
        } else {
          // Si no está seleccionado, verificamos que no exceda el máximo
          if (current.length >= group.maxSelections) {
            // No se puede agregar más, retornamos el estado sin cambios
            return state;
          }
          next = [...current, optionItem.id];
        }
      }

      return { ...state, [group.key]: next };
    });
  }

  /** Cambia la cantidad de un extra */
  changeExtraQuantity(extraId: string, delta: number): void {
    this.extraQty.update((state) => {
      const current = state[extraId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...state, [extraId]: next };
    });
  }

  /** Verifica si todos los grupos cumplen con sus restricciones */
  canConfirm(): boolean {
    const state = this.selectedByGroup();
    return this.sortedGroups().every((group) => {
      const size = (state[group.key] ?? []).length;
      return size >= group.minSelections && size <= group.maxSelections;
    });
  }

  /** Confirma la personalización y emite el resultado */
  submit(): void {
    if (!this.canConfirm()) {
      return;
    }

    const optionLookup = new Map(this.optionItems().map((item) => [item.id, item]));
    const selections = Object.entries(this.selectedByGroup()).flatMap(
      ([groupKey, selectedIds]) =>
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