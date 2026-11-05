import { Setting } from '../entities'

export interface SettingsRepository {
  getSettings(): Promise<Setting[]>
  upsertSetting(key: string, value: string): Promise<Setting>
}
