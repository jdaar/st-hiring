import * as yup from 'yup'
import { Event } from '../domain'
import { TicketSchema } from './ticket.schema'

export const EventSchema: yup.ObjectSchema<Event> = yup.object({
  id: yup.number().integer().required(),
  name: yup.string().required(),
  date: yup.date().required(),
  location: yup.string().required(),
  description: yup.string().required(),
  availableTickets: yup.array(TicketSchema).required(),
  createdAt: yup.date().required(),
  updatedAt: yup.date().required(),
})
