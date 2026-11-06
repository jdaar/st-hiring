export type ApplicationErrorDetail = {
  path: string
  message: string
}

export abstract class ApplicationError<C extends number = number> extends Error {
  abstract readonly code: C
  declare readonly details?: ApplicationErrorDetail[]
  declare readonly httpCode?: number
}

// what travels in a failure response
export type SerializedApplicationError = Pick<ApplicationError, 'code' | 'message' | 'details'>
