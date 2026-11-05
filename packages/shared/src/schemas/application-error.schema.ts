import * as yup from 'yup'
import { ApplicationErrorDetail } from '../domain'

export const ApplicationErrorSchema: yup.ObjectSchema<ApplicationErrorDetail> = yup.object({
  code: yup.number().integer().required(),
  message: yup.string().required(),
})
