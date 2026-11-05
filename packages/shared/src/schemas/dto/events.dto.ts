import * as yup from 'yup'
import { EventSchema } from '../entities'

export const GetPaginatedEventsResponseSchema = yup.object({
  data: yup.array(EventSchema).required(),
  pagination: yup
    .object({
      page: yup.number().integer().min(1).required(),
      pageSize: yup.number().integer().min(1).required(),
      total: yup.number().integer().min(0).required(),
      totalPages: yup.number().integer().min(0).required(),
    })
    .required(),
})

export type GetPaginatedEventsResponse = yup.InferType<typeof GetPaginatedEventsResponseSchema>
