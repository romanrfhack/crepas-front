import { Injectable, signal } from '@angular/core';

const TENANT_CONTEXT_KEY = 'platform_selected_tenant_id';

@Injectable({ providedIn: 'root' })
export class PlatformTenantContextService {
  private readonly selectedTenantIdSig = signal<string | null>(
    localStorage.getItem(TENANT_CONTEXT_KEY)?.trim() || null,
  );

  getSelectedTenantId() {
    return this.selectedTenantIdSig();
  }

  setSelectedTenantId(tenantId: string | null) {
    const normalizedTenantId = tenantId?.trim() || null;
    this.selectedTenantIdSig.set(normalizedTenantId);

    if (!normalizedTenantId) {
      localStorage.removeItem(TENANT_CONTEXT_KEY);
      return;
    }

    localStorage.setItem(TENANT_CONTEXT_KEY, normalizedTenantId);
  }
}
