import * as yup from 'yup'
import { CreateSettingInput, Setting, UpdateSettingInput } from '../../domain'
import { SettingSchema, SettingValueSchema } from '../entities'
import { createResponseSchema } from '../response.schema'

export const GetSettingsResponseSchema = createResponseSchema(yup.array(SettingSchema).required())

export type GetSettingsResponse = yup.InferType<typeof GetSettingsResponseSchema>

export const SettingParamsSchema: yup.ObjectSchema<Pick<Setting, 'id'>> = yup.object({
  id: yup.string().required(),
})

export type SettingParams = yup.InferType<typeof SettingParamsSchema>

const CreateSettingRequestSchema: yup.ObjectSchema<Omit<CreateSettingInput, 'id'>> = yup
  .object({
    value: SettingValueSchema.required(),
  })
  .noUnknown()

const UpdateSettingRequestSchema: yup.ObjectSchema<Omit<UpdateSettingInput, 'id'>> = yup
  .object({
    value: SettingValueSchema.required(),
    version: yup.number().integer().min(1).required(),
  })
  .noUnknown()

// body of PUT /settings/:id, without version it creates the setting, with it it updates that version
export type UpsertSettingRequest = Omit<CreateSettingInput, 'id'> | Omit<UpdateSettingInput, 'id'>

// typed explicitly: InferType of a lazy schema only keeps one of its branches
export const UpsertSettingRequestSchema: yup.Lazy<UpsertSettingRequest> = yup.lazy((value: unknown) =>
  typeof value === 'object' && value !== null && 'version' in value
    ? UpdateSettingRequestSchema
    : CreateSettingRequestSchema,
)

export const isUpdateSettingRequest = (request: UpsertSettingRequest): request is Omit<UpdateSettingInput, 'id'> =>
  'version' in request

export const UpsertSettingResponseSchema = createResponseSchema(SettingSchema.required())

export type UpsertSettingResponse = yup.InferType<typeof UpsertSettingResponseSchema>
