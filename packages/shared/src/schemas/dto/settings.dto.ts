import * as yup from 'yup'
import { SettingSchema } from '../setting.schema'

export const GetSettingsRequestSchema = yup.object({})

export type GetSettingsRequest = yup.InferType<typeof GetSettingsRequestSchema>

export const GetSettingsResponseSchema = yup.object({
  data: yup.array(SettingSchema).required(),
})

export type GetSettingsResponse = yup.InferType<typeof GetSettingsResponseSchema>

export const UpsertSettingRequestSchema = yup.object({
  key: yup.string().required(),
  value: yup.string().required(),
})

export type UpsertSettingRequest = yup.InferType<typeof UpsertSettingRequestSchema>

export const UpsertSettingResponseSchema = yup.object({
  data: SettingSchema.required(),
})

export type UpsertSettingResponse = yup.InferType<typeof UpsertSettingResponseSchema>
