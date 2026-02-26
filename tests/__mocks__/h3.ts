// Mock for h3 (Nuxt server framework)
export const readRawBody = (...args: any[]) => (globalThis as any).readRawBody?.(...args) ?? ''
export const setResponseHeader = (...args: any[]) => (globalThis as any).setResponseHeader?.(...args)
export const setResponseStatus = (...args: any[]) => (globalThis as any).setResponseStatus?.(...args)
export const getHeaders = (...args: any[]) => (globalThis as any).getHeaders?.(...args) ?? {}
export const getClientIP = () => '127.0.0.1'
export const defineEventHandler = (handler: Function) => handler
export const createError = (opts: { statusCode: number; statusMessage: string }) => {
  const error = new Error(opts.statusMessage) as any
  error.statusCode = opts.statusCode
  error.statusMessage = opts.statusMessage
  return error
}
export const readBody = async (event: any) => event?.__body || {}
