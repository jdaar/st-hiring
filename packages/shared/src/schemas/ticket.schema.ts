import * as yup from 'yup'
import { Ticket } from '../domain'

export const TicketSchema: yup.ObjectSchema<Ticket> = yup.object({
  id: yup.number().integer().required(),
  eventId: yup.number().integer().required(),
  type: yup.string().required(),
  status: yup.string().required(),
  price: yup.number().integer().required(),
  createdAt: yup.date().required(),
  updatedAt: yup.date().required(),
})
