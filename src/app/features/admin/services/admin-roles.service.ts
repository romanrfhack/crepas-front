import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { RoleDto } from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminRolesService {
  private readonly apiClient = inject(ApiClient);

  async getRoles() {
    return firstValueFrom(this.apiClient.get<RoleDto[]>('/v1/admin/roles'));
  }

  async createRole(name: string) {
    return firstValueFrom(this.apiClient.post<RoleDto>('/v1/admin/roles', { name }));
  }

  async deleteRole(roleId: string) {
    return firstValueFrom(this.apiClient.delete<void>(`/v1/admin/roles/${roleId}`));
  }
}
