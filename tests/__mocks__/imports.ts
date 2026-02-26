// Mock for #imports used by Nuxt server utils
export const useRuntimeConfig = () => ({
  TWILIO_ACCOUNT_SID: 'test-account-sid',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+15005550006',
  TWILIO_WEBHOOK_SECRET: 'test-webhook-secret',
  TWILIO_WEBHOOK_BASE_URL: 'https://test.example.com',
  CALL_PROFIT_MARGIN: 0.5,
  STRIPE_SECRET_KEY: 'sk_test_xxx',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_xxx',
  public: {
    TWILIO_REGION: 'us1',
  },
})

export const defineEventHandler = (handler: Function) => handler
export const createError = (opts: { statusCode: number; statusMessage: string; message?: string }) => {
  const error = new Error(opts.statusMessage || opts.message) as any
  error.statusCode = opts.statusCode
  error.statusMessage = opts.statusMessage
  return error
}
export const readBody = async (event: any) => event.__body || {}
export const getHeaders = (event: any) => event.__headers || {}
