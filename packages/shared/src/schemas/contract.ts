import * as yup from 'yup'
import { RequestSchemas } from './request.schema'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// one endpoint, served by the backend and called by the frontend
export interface EndpointContract<R extends RequestSchemas, S extends yup.ISchema<unknown>> {
  method: HttpMethod
  path: string
  request?: R
  response: S
}

// identity, keeps the schema types inferred
export const defineContract = <S extends yup.ISchema<unknown>, R extends RequestSchemas = Record<never, never>>(
  contract: EndpointContract<R, S>,
) => contract
