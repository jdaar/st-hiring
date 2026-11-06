export const TICKET_STATUSES = ['available', 'sold', 'reserved'] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export interface TicketTypeSummary {
  type: string
  faceValuePrice: string
  serviceFeePrice: string
  statusCounts: Record<TicketStatus, number>
}

export interface Ticket {
  id: number
  eventId: number
  type: string
  status: TicketStatus
  faceValuePrice: string
  serviceFeePrice: string
  createdAt: Date
  updatedAt: Date
}
