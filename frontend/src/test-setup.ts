import '@angular/compiler';

class ResizeObserverMock implements ResizeObserver {
  observe(): void {
    // no-op for unit tests
  }

  unobserve(): void {
    // no-op for unit tests
  }

  disconnect(): void {
    // no-op for unit tests
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock;
}


if (typeof SVGElement !== 'undefined') {
  const svgElementPrototype = SVGElement.prototype as SVGElement & {
    getBBox?: () => DOMRect;
  };

  if (!svgElementPrototype.getBBox) {
    svgElementPrototype.getBBox = () =>
      ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map<string, string>();

  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size;
    },
  } satisfies Storage;
}
