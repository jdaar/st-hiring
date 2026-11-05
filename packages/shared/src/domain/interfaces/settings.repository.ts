import { Setting } from '../entities'

export type CreateSettingInput = Pick<Setting, 'id' | 'value'>

export type UpdateSettingInput = Pick<Setting, 'id' | 'value' | 'version'>

export type UpsertSettingInput = CreateSettingInput | UpdateSettingInput

export interface SettingsRepository {
  getSettings(): Promise<Setting[]>
  upsertSetting(input: UpsertSettingInput): Promise<Setting>
}
