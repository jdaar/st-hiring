import * as yup from 'yup'
import { FailureResponse } from '../domain'
import { ApplicationErrorSchema } from './application-error.schema'

export const createSuccessResponseSchema = <T>(bodySchema: yup.Schema<T>) =>
  yup
    .object({
      isSuccess: yup.boolean<true>().oneOf([true]).required(),
      body: bodySchema,
    })
    .noUnknown()

export const FailureResponseSchema: yup.ObjectSchema<FailureResponse> = yup
  .object({
    isSuccess: yup.boolean<false>().oneOf([false]).required(),
    errors: yup.array(ApplicationErrorSchema).min(1).required(),
  })
  .noUnknown()

export const createResponseSchema = <T>(bodySchema: yup.Schema<T>) => {
  const SuccessResponseSchema = createSuccessResponseSchema(bodySchema)

  return yup.lazy((value: unknown) =>
    typeof value === 'object' && value !== null && 'isSuccess' in value && value.isSuccess === true
      ? SuccessResponseSchema
      : FailureResponseSchema,
  )
}
