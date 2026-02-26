// Provide Vue/Nuxt auto-imports as globals for test environment
import { ref, computed, watch, reactive, toRef, toRefs, nextTick, onMounted, onUnmounted, markRaw, shallowRef } from 'vue'

// Vue composition API globals
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).reactive = reactive
;(globalThis as any).toRef = toRef
;(globalThis as any).toRefs = toRefs
;(globalThis as any).nextTick = nextTick
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted
;(globalThis as any).markRaw = markRaw
;(globalThis as any).shallowRef = shallowRef

// Nuxt-specific globals
;(globalThis as any).navigateTo = (path: string) => ({ redirect: path })
;(globalThis as any).defineNuxtRouteMiddleware = (fn: Function) => fn
;(globalThis as any).useRuntimeConfig = () => ({
  TWILIO_WEBHOOK_SECRET: 'test-webhook-secret-key',
  TWILIO_ACCOUNT_SID: 'test-account-sid',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+15005550006',
  TWILIO_WEBHOOK_BASE_URL: 'https://test.example.com',
  CALL_PROFIT_MARGIN: 0.5,
  public: {
    TWILIO_REGION: 'us1',
  },
})
;(globalThis as any).useFetch = () => ({ data: ref(null), pending: ref(false), error: ref(null) })
;(globalThis as any).defineEventHandler = (handler: Function) => handler
;(globalThis as any).createError = (opts: { statusCode: number; statusMessage: string }) => {
  const error = new Error(opts.statusMessage) as any
  error.statusCode = opts.statusCode
  error.statusMessage = opts.statusMessage
  return error
}
;(globalThis as any).readBody = async (event: any) => event?.__body || {}
;(globalThis as any).getHeaders = (event: any) => event?.__headers || {}
;(globalThis as any).Ref = Object
