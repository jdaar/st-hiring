import * as yup from 'yup'
import { Setting, SettingValue } from '../../domain'

export const SettingValueSchema = yup
  .mixed<SettingValue>()
  .test(
    'setting-value',
    '${path} must be a string, number or boolean',
    (value) => value === undefined || ['string', 'number', 'boolean'].includes(typeof value),
  )

export const SettingSchema: yup.ObjectSchema<Setting> = yup.object({
  id: yup.string().required(),
  value: SettingValueSchema.required(),
  version: yup.number().integer().min(1).required(),
  createdAt: yup.date().required(),
  updatedAt: yup.date().required(),
})
