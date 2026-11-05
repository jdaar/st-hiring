export type SettingValue = string | number | boolean

export interface Setting {
  id: string
  value: SettingValue
  version: number
  updatedAt: Date
}
