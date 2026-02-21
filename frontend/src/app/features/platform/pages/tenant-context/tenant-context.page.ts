import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PlatformTenantContextService } from '../../services/platform-tenant-context.service';

@Component({
  selector: 'app-tenant-context-page',
  imports: [ReactiveFormsModule],
  template: `
    <section>
      <h2>Contexto de tenant (SuperAdmin)</h2>
      <label for="tenant-context-id">Tenant ID</label>
      <input
        id="tenant-context-id"
        [formControl]="tenantIdControl"
        data-testid="platform-tenant-context-select"
      />
      <button type="button" (click)="save()">Guardar contexto</button>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantContextPage {
  private readonly tenantContext = inject(PlatformTenantContextService);

  readonly tenantIdControl = new FormControl(this.tenantContext.getSelectedTenantId() ?? '', {
    nonNullable: true,
  });

  save() {
    this.tenantContext.setSelectedTenantId(this.tenantIdControl.value || null);
  }
}
