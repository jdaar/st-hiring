import { ApplicationError, ApplicationErrorDetail, SerializedApplicationError } from './application-error'

// raised by the frontend while calling the backend (2xxx); ApiError keeps the backend's code

// the backend answered with a failure envelope
export class ApiError extends ApplicationError {
  readonly name = 'ApiError'
  readonly code: number
  readonly details?: ApplicationErrorDetail[]

  constructor(
    { code, message, details }: SerializedApplicationError,
    readonly httpCode: number,
    readonly transactionId: string,
  ) {
    super(message)
    this.code = code
    this.details = details
  }
}

// no answer at all (offline, connection refused, CORS)
export class NetworkError extends ApplicationError<2000> {
  static readonly code = 2000
  readonly name = 'NetworkError'
  readonly code = NetworkError.code

  constructor(
    readonly transactionId: string,
    options?: ErrorOptions,
  ) {
    super('Network request failed', options)
  }
}

// the input does not match the request DTO, nothing was sent
export class RequestValidationError extends ApplicationError<2001> {
  static readonly code = 2001
  readonly name = 'RequestValidationError'
  readonly code = RequestValidationError.code

  constructor(readonly details: ApplicationErrorDetail[]) {
    super('Request validation failed')
  }
}

// the answer does not match the response DTO
export class ResponseValidationError extends ApplicationError<2002> {
  static readonly code = 2002
  readonly name = 'ResponseValidationError'
  readonly code = ResponseValidationError.code

  constructor(
    readonly details: ApplicationErrorDetail[],
    readonly httpCode: number,
    readonly transactionId: string,
  ) {
    super('Response validation failed')
  }
}

export type ApiClientError = ApiError | NetworkError | RequestValidationError | ResponseValidationError
