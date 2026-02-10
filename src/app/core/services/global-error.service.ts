import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GlobalErrorService {
  private readonly messageSig = signal<string | null>(null);
  readonly message = computed(() => this.messageSig());

  setMessage(message: string) {
    this.messageSig.set(message);
  }

  clear() {
    this.messageSig.set(null);
  }
}
