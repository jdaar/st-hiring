import { Event } from '../entities'

export interface EventsRepository {
  getPaginatedEvents(page: number, pageSize: number): Promise<{ events: Event[]; total: number }>
}
