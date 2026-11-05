import * as yup from 'yup'
import { ApplicationErrorDetail, SerializedApplicationError } from '../domain'

export const ApplicationErrorDetailSchema: yup.ObjectSchema<ApplicationErrorDetail> = yup.object({
  path: yup.string().defined(),
  message: yup.string().required(),
})

export const ApplicationErrorSchema: yup.ObjectSchema<SerializedApplicationError> = yup.object({
  code: yup.number().integer().required(),
  message: yup.string().required(),
  details: yup.array(ApplicationErrorDetailSchema).optional(),
})
