export interface ApplicationError<C extends number = number> extends Error {
  code: C
  message: string
}
