import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { OptionSetDto, SchemaDto, SelectionGroupDto } from '../../models/pos-catalog.models';
import { PosCatalogApiService } from '../../services/pos-catalog-api.service';

@Component({
  selector: 'app-pos-catalog-schemas-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h2>Schemas y groups</h2>
      <form class="row" (submit)="onSubmitSchema($event)">
        <input [formControl]="schemaNameControl" placeholder="Nombre schema" />
        <label><input [formControl]="schemaIsActiveControl" type="checkbox" /> Activo</label>
        <button type="submit">Crear schema</button>
      </form>

      <label>
        Schema seleccionado
        <select [formControl]="selectedSchemaIdControl">
          @for (item of schemas(); track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }
        </select>
      </label>

      <form class="grid" (submit)="onSubmitGroup($event)">
        <input [formControl]="groupKeyControl" placeholder="key" />
        <input [formControl]="groupLabelControl" placeholder="label" />
        <select [formControl]="groupSelectionModeControl">
          <option [value]="0">Single</option>
          <option [value]="1">Multi</option>
        </select>
        <input [formControl]="groupMinControl" type="number" min="0" />
        <input [formControl]="groupMaxControl" type="number" min="0" />
        <select [formControl]="groupOptionSetIdControl">
          @for (item of optionSets(); track item.id) {
            <option [value]="item.id">{{ item.name }}</option>
          }
        </select>
        <label><input [formControl]="groupIsActiveControl" type="checkbox" /> Activo</label>
        <button type="submit">{{ editingGroupId() ? 'Guardar group' : 'Crear group' }}</button>
      </form>

      @if (errorMessage()) {
        <p class="inline-error" role="alert">{{ errorMessage() }}</p>
      }

      <ul class="list">
        @for (group of groups(); track group.id) {
          <li>
            <span>{{ group.key }} - {{ group.label }} ({{ group.selectionMode === 0 ? 'Single' : 'Multi' }})</span>
            <div class="actions">
              <button type="button" (click)="onEditGroup(group)">Editar</button>
              <button type="button" (click)="onDeactivateGroup(group)">Desactivar</button>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 0.75rem; }
    .row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; align-items: center; }
    input, select { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.5rem; font: inherit; }
    button { border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.45rem 0.75rem; background: #fff; cursor: pointer; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .list li { display: flex; justify-content: space-between; gap: 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.7rem; background: #fff; }
    .actions { display: flex; gap: 0.5rem; }
    .inline-error { margin: 0; padding: 0.5rem; border-radius: 0.5rem; background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemasPage {
  private readonly api = inject(PosCatalogApiService);

  readonly schemas = signal<SchemaDto[]>([]);
  readonly optionSets = signal<OptionSetDto[]>([]);
  readonly groups = signal<SelectionGroupDto[]>([]);
  readonly errorMessage = signal('');
  readonly editingGroupId = signal<string | null>(null);

  readonly schemaNameControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly schemaIsActiveControl = new FormControl(true, { nonNullable: true });
  readonly selectedSchemaIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  readonly groupKeyControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly groupLabelControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly groupSelectionModeControl = new FormControl(0, { nonNullable: true });
  readonly groupMinControl = new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] });
  readonly groupMaxControl = new FormControl(1, { nonNullable: true, validators: [Validators.min(1)] });
  readonly groupOptionSetIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly groupIsActiveControl = new FormControl(true, { nonNullable: true });

  constructor() {
    this.selectedSchemaIdControl.valueChanges.subscribe(() => {
      void this.loadGroups();
    });
    void this.bootstrap();
  }

  async onSubmitSchema(event: Event) {
    event.preventDefault();
    if (this.schemaNameControl.invalid) {
      return;
    }

    try {
      await this.api.createSchema({ name: this.schemaNameControl.value.trim(), isActive: this.schemaIsActiveControl.value });
      this.schemaNameControl.setValue('');
      await this.loadSchemas();
    } catch {
      this.errorMessage.set('No fue posible guardar el schema.');
    }
  }

  async onSubmitGroup(event: Event) {
    event.preventDefault();
    const schemaId = this.selectedSchemaIdControl.value;
    if (!schemaId || this.groupKeyControl.invalid || this.groupLabelControl.invalid || this.groupOptionSetIdControl.invalid) {
      return;
    }

    try {
      const payload = {
        key: this.groupKeyControl.value.trim(),
        label: this.groupLabelControl.value.trim(),
        selectionMode: Number(this.groupSelectionModeControl.value),
        minSelections: this.groupMinControl.value,
        maxSelections: this.groupMaxControl.value,
        optionSetId: this.groupOptionSetIdControl.value,
        isActive: this.groupIsActiveControl.value,
        sortOrder: 0,
      };
      const groupId = this.editingGroupId();
      if (groupId) {
        await this.api.updateGroup(schemaId, groupId, payload);
      } else {
        await this.api.createGroup(schemaId, payload);
      }
      this.editingGroupId.set(null);
      this.groupKeyControl.setValue('');
      this.groupLabelControl.setValue('');
      await this.loadGroups();
    } catch {
      this.errorMessage.set('No fue posible guardar el group.');
    }
  }

  onEditGroup(group: SelectionGroupDto) {
    this.editingGroupId.set(group.id);
    this.groupKeyControl.setValue(group.key);
    this.groupLabelControl.setValue(group.label);
    this.groupSelectionModeControl.setValue(group.selectionMode);
    this.groupMinControl.setValue(group.minSelections);
    this.groupMaxControl.setValue(group.maxSelections);
    this.groupOptionSetIdControl.setValue(group.optionSetId);
    this.groupIsActiveControl.setValue(group.isActive);
  }

  async onDeactivateGroup(group: SelectionGroupDto) {
    const schemaId = this.selectedSchemaIdControl.value;
    if (!schemaId) {
      return;
    }

    try {
      await this.api.deactivateGroup(schemaId, group.id);
      await this.loadGroups();
    } catch {
      this.errorMessage.set('No fue posible desactivar el group.');
    }
  }

  private async bootstrap() {
    try {
      await Promise.all([this.loadSchemas(), this.loadOptionSets()]);
      await this.loadGroups();
    } catch {
      this.errorMessage.set('No fue posible cargar schemas.');
    }
  }

  private async loadSchemas() {
    const schemas = await this.api.getSchemas(true);
    this.schemas.set(schemas);
    if (schemas.length > 0) {
      this.selectedSchemaIdControl.setValue(schemas[0].id);
    }
  }

  private async loadOptionSets() {
    const sets = await this.api.getOptionSets(true);
    this.optionSets.set(sets);
    if (sets.length > 0) {
      this.groupOptionSetIdControl.setValue(sets[0].id);
    }
  }

  private async loadGroups() {
    const schemaId = this.selectedSchemaIdControl.value;
    if (!schemaId) {
      this.groups.set([]);
      return;
    }

    this.groups.set(await this.api.getGroups(schemaId, true));
  }
}
