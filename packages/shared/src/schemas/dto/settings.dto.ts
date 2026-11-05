import * as yup from 'yup'
import { CreateSettingInput, UpdateSettingInput, UpsertSettingInput } from '../../domain'
import { SettingSchema, SettingValueSchema } from '../entities'
import { createResponseSchema } from '../response.schema'

export const GetSettingsResponseSchema = createResponseSchema(yup.array(SettingSchema).required())

export type GetSettingsResponse = yup.InferType<typeof GetSettingsResponseSchema>

const CreateSettingRequestSchema: yup.ObjectSchema<CreateSettingInput> = yup
  .object({
    id: yup.string().required(),
    value: SettingValueSchema.required(),
  })
  .noUnknown()

const UpdateSettingRequestSchema: yup.ObjectSchema<UpdateSettingInput> = yup
  .object({
    id: yup.string().required(),
    value: SettingValueSchema.required(),
    version: yup.number().integer().min(1).required(),
  })
  .noUnknown()

export const UpsertSettingRequestSchema = yup.lazy((value: unknown) =>
  typeof value === 'object' && value !== null && 'version' in value
    ? UpdateSettingRequestSchema
    : CreateSettingRequestSchema,
)

export type UpsertSettingRequest = UpsertSettingInput

export const UpsertSettingResponseSchema = createResponseSchema(SettingSchema.required())

export type UpsertSettingResponse = yup.InferType<typeof UpsertSettingResponseSchema>
