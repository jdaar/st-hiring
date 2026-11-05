export type SettingValue = string | number | boolean

export interface Setting {
  id: string
  value: SettingValue
  version: number
  createdAt: Date
  updatedAt: Date
}
