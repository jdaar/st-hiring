import { Event } from '../entities'

export interface EventsRepository {
  getPaginatedEvents(
    limit: number,
    cursor: string | null,
  ): Promise<{ events: Event[]; nextCursor: string | null }>
}
