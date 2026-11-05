import * as yup from 'yup'
import { Setting } from '../domain'

export const SettingSchema: yup.ObjectSchema<Setting> = yup.object({
  key: yup.string().required(),
  value: yup.string().required(),
  createdAt: yup.date().required(),
  updatedAt: yup.date().required(),
})
