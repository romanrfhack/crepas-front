import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/services/api-client';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  it('createUser should post exact backend payload', async () => {
    const postMock = vi.fn().mockReturnValue(of({ id: 'user-1' }));

    TestBed.configureTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: ApiClient,
          useValue: {
            get: vi.fn(),
            post: postMock,
            put: vi.fn(),
            delete: vi.fn(),
          },
        },
      ],
    });

    const service = TestBed.inject(AdminUsersService);

    await service.createUser({
      email: 'new@example.com',
      userName: 'new.user',
      role: 'AdminStore',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      temporaryPassword: 'Temp123!',
    });

    expect(postMock).toHaveBeenCalledWith('/v1/admin/users', {
      email: 'new@example.com',
      userName: 'new.user',
      role: 'AdminStore',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      temporaryPassword: 'Temp123!',
    });
  });

  it('setTemporaryPassword should post exact backend payload', async () => {
    const postMock = vi.fn().mockReturnValue(of({ id: 'user-1', message: 'ok' }));

    TestBed.configureTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: ApiClient,
          useValue: {
            get: vi.fn(),
            post: postMock,
            put: vi.fn(),
            delete: vi.fn(),
          },
        },
      ],
    });

    const service = TestBed.inject(AdminUsersService);

    await service.setTemporaryPassword('user-1', {
      temporaryPassword: 'Temp1234!',
    });

    expect(postMock).toHaveBeenCalledWith('/v1/admin/users/user-1/temporary-password', {
      temporaryPassword: 'Temp1234!',
    });
  });

});
