export type ApplicationErrorDetail = {
  path: string
  message: string
}

export interface ApplicationError<C extends number = number> extends Error {
  code: C
  message: string
  details?: ApplicationErrorDetail[]
  httpCode?: number
}
