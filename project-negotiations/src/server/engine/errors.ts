/** Engine validation errors are mapped to HTTP 400/409 by the API layer. */
export class EngineError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'EngineError';
  }
}
