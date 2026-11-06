import { ApplicationError } from './application-error'

export type SerializedApplicationError = Pick<ApplicationError, 'code' | 'message' | 'details'>

export type SuccessResponse<T> = {
  isSuccess: true
  body: T
}

export type FailureResponse = {
  isSuccess: false
  error: SerializedApplicationError
}

export type ResponseBody<R> = Extract<R, { isSuccess: true }> extends SuccessResponse<infer T> ? T : never

export const createSuccessResponse = <T>(body: T): SuccessResponse<T> => ({
  isSuccess: true,
  body,
})

export const createFailureResponse = ({ code, message, details }: SerializedApplicationError): FailureResponse => ({
  isSuccess: false,
  error: details ? { code, message, details } : { code, message },
})
