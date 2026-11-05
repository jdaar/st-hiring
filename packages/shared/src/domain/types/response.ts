import { ApplicationError } from './application-error'

export type ApplicationErrorDetail = Pick<ApplicationError, 'code' | 'message'>

export type SuccessResponse<T> = {
  isSuccess: true
  body: T
}

export type FailureResponse = {
  isSuccess: false
  errors: ApplicationErrorDetail[]
}

export const createSuccessResponse = <T>(body: T): SuccessResponse<T> => ({
  isSuccess: true,
  body,
})

export const createFailureResponse = (...errors: ApplicationErrorDetail[]): FailureResponse => ({
  isSuccess: false,
  errors: errors.map(({ code, message }) => ({ code, message })),
})
