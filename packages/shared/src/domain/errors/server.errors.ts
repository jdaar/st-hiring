import { ApplicationError, ApplicationErrorDetail } from './application-error'

// thrown by the backend (1xxx), recognised by the frontend through the static code

export class ValidationFailedError extends ApplicationError<1000> {
  static readonly code = 1000
  readonly code = ValidationFailedError.code
  readonly httpCode = 400

  constructor(readonly details: ApplicationErrorDetail[]) {
    super('Validation failed')
  }
}

export class SettingNotFoundError extends ApplicationError<1001> {
  static readonly code = 1001
  readonly code = SettingNotFoundError.code
  readonly httpCode = 404

  constructor(id: string) {
    super(`Setting "${id}" does not exist`)
  }
}

export class SettingVersionConflictError extends ApplicationError<1002> {
  static readonly code = 1002
  readonly code = SettingVersionConflictError.code
  readonly httpCode = 409

  constructor(id: string, version: number) {
    super(`Setting "${id}" was modified; version ${version} is stale`)
  }
}

export class SettingAlreadyExistsError extends ApplicationError<1003> {
  static readonly code = 1003
  readonly code = SettingAlreadyExistsError.code
  readonly httpCode = 409

  constructor(id: string) {
    super(`Setting "${id}" already exists; send its version to update it`)
  }
}

export class RouteNotFoundError extends ApplicationError<1004> {
  static readonly code = 1004
  readonly code = RouteNotFoundError.code
  readonly httpCode = 404

  constructor(method: string, path: string) {
    super(`Route ${method} ${path} does not exist`)
  }
}

export class InternalError extends ApplicationError<1999> {
  static readonly code = 1999
  readonly code = InternalError.code
  readonly httpCode = 500

  constructor(options?: ErrorOptions) {
    super('Internal server error', options)
  }
}
