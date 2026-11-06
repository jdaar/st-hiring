import * as yup from 'yup'
import { ApplicationErrorDetail } from '../domain'

export const REQUEST_SOURCES = ['params', 'query', 'body'] as const

export type RequestSource = (typeof REQUEST_SOURCES)[number]

export type RequestSchemas = Partial<Record<RequestSource, yup.ISchema<unknown>>>

export type InferSchema<S> = S extends yup.ISchema<infer T> ? T : never

export type RequestValues = Partial<Record<RequestSource, unknown>>

export const toErrorDetails = (error: yup.ValidationError, fallbackPath: string): ApplicationErrorDetail[] =>
  (error.inner.length ? error.inner : [error]).map(({ path, message }) => ({ path: path || fallbackPath, message }))

// shared by backend and frontend so both accept exactly the same input
export const validateRequestSources = async (
  schemas: RequestSchemas,
  input: RequestValues,
): Promise<{ values: RequestValues; details: ApplicationErrorDetail[] }> => {
  const values: RequestValues = {}
  const details: ApplicationErrorDetail[] = []

  for (const source of REQUEST_SOURCES) {
    const schema = schemas[source]
    if (!schema) continue

    try {
      // otherwise noUnknown() schemas silently drop extra keys instead of rejecting them
      values[source] = await schema.validate(input[source], { abortEarly: false, stripUnknown: false })
    } catch (error) {
      if (!(error instanceof yup.ValidationError)) throw error
      details.push(...toErrorDetails(error, source))
    }
  }

  return { values, details }
}
