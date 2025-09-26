export class Deferred<T> {
  // resolveFn/rejectFn are initialized to typed no-ops to avoid using `any`.
  private resolveFn: (value: T | PromiseLike<T>) => void = (
    _value: T | PromiseLike<T>
  ) => {
    // explicitly reference the parameter to satisfy no-unused-vars rules
    void _value
  }
  private rejectFn: (reason?: unknown) => void = (_reason?: unknown) => {
    void _reason
  }
  private _promise: Promise<T>

  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this.resolveFn = resolve
      this.rejectFn = reject
    })
  }

  get promise(): Promise<T> {
    return this._promise
  }

  resolve(value: T | PromiseLike<T>): void {
    this.resolveFn(value)
  }

  reject(reason?: unknown): void {
    this.rejectFn(reason)
  }
}
