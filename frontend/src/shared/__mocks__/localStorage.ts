export class LocalStorageMock {
  private store: Record<string, string> = {}
  clear() { this.store = {} }
  getItem(key: string) { return this.store[key] ?? null }
  setItem(key: string, value: string) { this.store[key] = String(value) }
  removeItem(key: string) { delete this.store[key] }
}

export function installLocalStorageMock() {
  const mock = new LocalStorageMock()
  Object.defineProperty(window, 'localStorage', {
    value: mock,
    writable: false,
  })
  return mock
}
