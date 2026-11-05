import * as yup from 'yup'
import { EventSchema } from '../event.schema'

export const GetPaginatedEventsRequestSchema = yup.object({
  cursor: yup.string().optional(),
  limit: yup.number().integer().min(1).max(100).default(20),
})

export type GetPaginatedEventsRequest = yup.InferType<typeof GetPaginatedEventsRequestSchema>

export const GetPaginatedEventsResponseSchema = yup.object({
  data: yup.array(EventSchema).required(),
  pagination: yup
    .object({
      nextCursor: yup.string().nullable().defined(),
      hasMore: yup.boolean().required(),
    })
    .required(),
})

export type GetPaginatedEventsResponse = yup.InferType<typeof GetPaginatedEventsResponseSchema>
