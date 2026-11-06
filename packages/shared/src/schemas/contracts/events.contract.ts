import { defineContract } from '../contract'
import { GetPaginatedEventsRequestSchema, GetPaginatedEventsResponseSchema } from '../dto'

export const GetPaginatedEventsEndpoint = defineContract({
  method: 'GET',
  path: '/v1/events',
  request: { query: GetPaginatedEventsRequestSchema },
  response: GetPaginatedEventsResponseSchema,
})
