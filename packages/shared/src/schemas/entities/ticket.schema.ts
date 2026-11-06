import * as yup from 'yup'
import { TICKET_STATUSES, Ticket, TicketTypeSummary } from '../../domain'

const DecimalSchema = yup.string().matches(/^\d{1,15}(\.\d{1,4})?$/, '${path} must be a numeric(19, 4) decimal')

export const TicketSchema: yup.ObjectSchema<Ticket> = yup.object({
  id: yup.number().integer().required(),
  eventId: yup.number().integer().required(),
  type: yup.string().required(),
  status: yup.string().oneOf(TICKET_STATUSES).required(),
  faceValuePrice: DecimalSchema.required(),
  serviceFeePrice: DecimalSchema.required(),
  createdAt: yup.date().required(),
  updatedAt: yup.date().required(),
})

const StatusCountSchema = yup.number().integer().min(0).required()

export const TicketTypeSummarySchema: yup.ObjectSchema<TicketTypeSummary> = yup.object({
  type: yup.string().required(),
  faceValuePrice: DecimalSchema.required(),
  serviceFeePrice: DecimalSchema.required(),
  statusCounts: yup
    .object({
      available: StatusCountSchema,
      sold: StatusCountSchema,
      reserved: StatusCountSchema,
    })
    .required(),
})
