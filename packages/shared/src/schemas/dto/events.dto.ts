import * as yup from 'yup'
import { EventSchema } from '../entities'
import { createResponseSchema } from '../response.schema'

export const GetPaginatedEventsResponseSchema = createResponseSchema(
  yup
    .object({
      events: yup.array(EventSchema).required(),
      pagination: yup
        .object({
          page: yup.number().integer().min(1).required(),
          pageSize: yup.number().integer().min(1).required(),
          total: yup.number().integer().min(0).required(),
          totalPages: yup.number().integer().min(0).required(),
        })
        .required(),
    })
    .required(),
)

export type GetPaginatedEventsResponse = yup.InferType<typeof GetPaginatedEventsResponseSchema>
