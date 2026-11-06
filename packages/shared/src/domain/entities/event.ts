import { TicketTypeSummary } from './ticket'

export interface Event {
  id: number
  name: string
  date: Date
  location: string
  description: string
  ticketTypes: TicketTypeSummary[]
  createdAt: Date
  updatedAt: Date
}
