import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlatformCatalogTemplatesApiService } from '../../services/platform-catalog-templates-api.service';

@Component({
  selector: 'app-tenant-template-assignment-page',
  imports: [ReactiveFormsModule],
  template: `
    <section>
      <h2>Asignar template a tenant</h2>
      <label for="tenant-select">Tenant ID</label>
      <input id="tenant-select" [formControl]="tenantIdControl" data-testid="platform-assign-tenant" />

      <label for="template-select">Template</label>
      <select id="template-select" [formControl]="templateIdControl" data-testid="platform-assign-template">
        <option value="" disabled>Selecciona template</option>
        @for (template of templates(); track template.id) {
          <option [value]="template.id">{{ template.name }} ({{ template.verticalId }})</option>
        }
      </select>

      <button type="button" data-testid="platform-assign-submit" (click)="assign()">Asignar</button>
      @if (message()) {
        <p>{{ message() }}</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantTemplateAssignmentPage {
  private readonly api = inject(PlatformCatalogTemplatesApiService);

  readonly templates = signal<Array<{ id: string; name: string; verticalId: string }>>([]);
  readonly message = signal('');

  readonly tenantIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly templateIdControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  constructor() {
    void this.load();
  }

  private async load() {
    this.templates.set(await this.api.listTemplates());
  }

  async assign() {
    this.message.set('');
    if (this.tenantIdControl.invalid || this.templateIdControl.invalid) {
      return;
    }

    try {
      await this.api.assignTemplateToTenant(this.tenantIdControl.value, {
        catalogTemplateId: this.templateIdControl.value,
      });
      this.message.set('Template asignado.');
    } catch {
      this.message.set('No fue posible asignar template.');
    }
  }
}
