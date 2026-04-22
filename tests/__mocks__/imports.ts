// Mock for #imports used by Nuxt server utils
export const useRuntimeConfig = () => ({
  twilioAccountSid: 'test-account-sid',
  twilioAuthToken: 'test-auth-token',
  twilioPhoneNumber: '+15005550006',
  twilioWebhookSecret: 'test-webhook-secret',
  twilioWebhookBaseUrl: 'https://test.example.com',
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
