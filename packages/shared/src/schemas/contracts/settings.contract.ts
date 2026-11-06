import { defineContract } from '../contract'
import {
  GetSettingsResponseSchema,
  SettingParamsSchema,
  UpsertSettingRequestSchema,
  UpsertSettingResponseSchema,
} from '../dto'

export const GetSettingsEndpoint = defineContract({
  method: 'GET',
  path: '/v1/settings',
  response: GetSettingsResponseSchema,
})

// without version it creates the setting, with it it updates that version
export const UpsertSettingEndpoint = defineContract({
  method: 'PUT',
  path: '/v1/settings/:id',
  request: { params: SettingParamsSchema, body: UpsertSettingRequestSchema },
  response: UpsertSettingResponseSchema,
})
