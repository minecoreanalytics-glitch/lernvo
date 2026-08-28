export type MobileApiErrorOptions = Readonly<{
  code: string;
  message: string;
  requestId: string;
  retryable: boolean;
  status?: number;
  details?: unknown;
}>;

export class MobileApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly status?: number;
  readonly details?: unknown;

  constructor(options: MobileApiErrorOptions) {
    super(options.message);
    this.name = 'MobileApiError';
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryable = options.retryable;
    this.status = options.status;
    this.details = options.details;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      requestId: this.requestId,
      retryable: this.retryable,
      status: this.status,
      details: this.details,
    };
  }
}
