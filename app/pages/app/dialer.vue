<script lang="ts" setup>
import { markRaw, shallowRef, onMounted, onUnmounted } from "vue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { isValidPhoneNumber } from "libphonenumber-js";
import { Device, Call } from "@twilio/voice-sdk";
import { useToast } from "~/components/ui/toast/use-toast";

const queryClient = useQueryClient();
const { toast } = useToast();

const { data: wallet, isLoading: walletLoading } = useQuery({
  queryKey: ["wallet"],
  queryFn: async () => await $fetch("/api/wallet"),
});

const phoneNumber = ref("+218910098190");
const isCalling = ref(false);
const callStatus = ref<string | null>(null);
const currentCall = ref<{
  callId: number;
  twilioCallSid: string;
  status: string;
  maxAllowedSeconds: number;
} | null>(null);
const pollingInterval = ref<NodeJS.Timeout | null>(null);

// Use shallowRef to prevent Vue from making Twilio SDK objects reactive
const device = shallowRef<Device | null>(null);
const activeCall = shallowRef<Call | null>(null);
const isDeviceReady = ref(false);
const deviceError = ref<string | null>(null);
const isInitializingDevice = ref(false);

// Reconnection state
const reconnectAttempts = ref(0);
const maxReconnectAttempts = 3;
const reconnectTimeout = ref<NodeJS.Timeout | null>(null);
const isReconnecting = ref(false);
const config = useRuntimeConfig();

const isValidPhone = computed(() => {
  if (!phoneNumber.value) return false;
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(phoneNumber.value)) return false;
  try {
    return isValidPhoneNumber(phoneNumber.value);
  } catch {
    return false;
  }
});

// Debounced phone number for rate lookup (avoids spamming the API on every keystroke)
const debouncedPhone = ref(phoneNumber.value);
let debounceTimer: NodeJS.Timeout | null = null;
watch(phoneNumber, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedPhone.value = val;
  }, 500);
});

// Fetch call rate for the current phone number
const {
  data: callRate,
  isLoading: rateLoading,
  error: rateError,
} = useQuery({
  queryKey: computed(() => ["callRate", debouncedPhone.value]),
  queryFn: async () => {
    return await $fetch("/api/calls/rate", {
      method: "POST",
      body: { toNumber: debouncedPhone.value },
    });
  },
  enabled: computed(() => isValidPhone.value && !isCalling.value),
  retry: false,
  staleTime: 30_000, // Cache rate for 30 seconds
});

const remainingMinutes = computed(() => {
  return callRate.value?.maxAllowedMinutes ?? 0;
});

const userRatePerMin = computed(() => {
  return callRate.value?.userRatePerMinUsd ?? null;
});

const invalidateQueries = () => {
  queryClient.invalidateQueries({ queryKey: ["wallet"] });
  queryClient.invalidateQueries({ queryKey: ["calls"] });
  queryClient.invalidateQueries({ queryKey: ["callRate"] });
};

const clearPolling = () => {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
    pollingInterval.value = null;
  }
};

const checkMicrophonePermission = async (): Promise<boolean> => {
  try {
    if (!navigator.permissions) {
      // Permissions API not supported, return false to show button
      return false;
    }
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state === 'granted';
  } catch (error) {
    // If permission check fails, default to showing button
    return false;
  }
};

// Helper function to log connection events
const logConnectionEvent = (event: string, details?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Twilio Device] ${event}`, details || '');
  }
};

// Clean up device properly
const cleanupDevice = () => {
  if (device.value) {
    try {
      device.value.removeAllListeners();
      device.value.destroy();
    } catch (error) {
      logConnectionEvent('Error during device cleanup', error);
    }
    device.value = null;
  }
  isDeviceReady.value = false;
};

// Attempt reconnection with exponential backoff
const attemptReconnection = async () => {
  if (isReconnecting.value || reconnectAttempts.value >= maxReconnectAttempts) {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      deviceError.value = `Connection failed after ${maxReconnectAttempts} attempts. Please try again.`;
      isReconnecting.value = false;
      reconnectAttempts.value = 0;
      logConnectionEvent('Max reconnection attempts reached');
    }
    return;
  }

  isReconnecting.value = true;
  reconnectAttempts.value += 1;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value - 1), 4000); // 1s, 2s, 4s max

  logConnectionEvent('Scheduling reconnection attempt', {
    attempt: reconnectAttempts.value,
    delay: `${delay}ms`,
  });

  reconnectTimeout.value = setTimeout(async () => {
    logConnectionEvent('Attempting reconnection', { attempt: reconnectAttempts.value });
    cleanupDevice();
    await initializeDevice(true);
  }, delay);
};

// Cancel any pending reconnection
const cancelReconnection = () => {
  if (reconnectTimeout.value) {
    clearTimeout(reconnectTimeout.value);
    reconnectTimeout.value = null;
  }
  isReconnecting.value = false;
};

const initializeDevice = async (isRetry = false) => {
  // Prevent multiple simultaneous initialization attempts
  if (device.value || (isInitializingDevice.value && !isRetry)) return;

  isInitializingDevice.value = true;
  if (!isRetry) {
    deviceError.value = null;
    reconnectAttempts.value = 0;
    cancelReconnection();
  }

  try {
    logConnectionEvent('Fetching Twilio token');
    const { token } = await $fetch("/api/twilio/token");
    
    if (!token || typeof token !== "string" || token.length === 0) {
      throw new Error("Invalid token: token is empty or not a string");
    }

    // Get region from config, default to 'us1'
    const region = config.public.TWILIO_REGION || 'us1';
    logConnectionEvent('Initializing Device', { region });

    // Device initialization options
    const deviceOptions = {
      region: region,
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn' as 'debug' | 'warn' | 'error' | 'info' | 'silent',
    };

    const newDevice = new Device(token, deviceOptions);

    // Handle successful registration
    newDevice.on("registered", () => {
      logConnectionEvent('Device registered successfully', { region });
      isDeviceReady.value = true;
      deviceError.value = null;
      isInitializingDevice.value = false;
      isReconnecting.value = false;
      reconnectAttempts.value = 0; // Reset retry counter on success
      cancelReconnection();
    });

    // Handle unregistered event (connection lost)
    newDevice.on("unregistered", (error: any) => {
      logConnectionEvent('Device unregistered', { error: error?.message || 'Connection lost' });
      isDeviceReady.value = false;
      
      // Only attempt reconnection if we're not already reconnecting and not during a call
      if (!isReconnecting.value && !isCalling.value) {
        attemptReconnection();
      }
    });

    // Handle token expiration
    newDevice.on("tokenWillExpire", async () => {
      logConnectionEvent('Token will expire soon, refreshing');
      try {
        const { token: newToken } = await $fetch("/api/twilio/token");
        if (newToken && typeof newToken === "string") {
          newDevice.updateToken(newToken);
          logConnectionEvent('Token refreshed successfully');
        }
      } catch (error: any) {
        logConnectionEvent('Failed to refresh token', { error: error.message });
        deviceError.value = "Failed to refresh connection token";
      }
    });

    // Enhanced error handling
    newDevice.on("error", (error: any) => {
      const errorCode = error.code;
      const errorMessage = error.message || "Device error";
      
      logConnectionEvent('Device error', { 
        code: errorCode, 
        message: errorMessage,
        name: error.name 
      });

      // Handle specific error codes
      if (errorCode === 31005) {
        // WebSocket connection error
        // Check if this is during a HANGUP event (normal call termination) vs connection setup failure
        const isHangupError = errorMessage?.toLowerCase().includes('hangup') || 
                              errorMessage?.toLowerCase().includes('error sent from gateway in hangup');
        
        logConnectionEvent('WebSocket connection error (31005) detected', { 
          isHangupError,
          isCalling: isCalling.value 
        });
        
        // If this is a HANGUP-related error during a call, it's normal termination - don't reconnect
        if (isHangupError && isCalling.value) {
          logConnectionEvent('31005 error during HANGUP (normal call termination), not reconnecting');
          // Don't change device state or attempt reconnection for normal call terminations
          return;
        }
        
        // For 31005 errors during connection setup or when not in a call, attempt reconnection
        isDeviceReady.value = false;
        isInitializingDevice.value = false;
        
        // Attempt reconnection for connection errors (only if not during a call)
        if (!isReconnecting.value && !isCalling.value) {
          deviceError.value = "Connection lost. Attempting to reconnect...";
          attemptReconnection();
        } else {
          deviceError.value = "Connection error. Please try again.";
        }
      } else if (errorCode === 31205 || errorCode === 31208) {
        // Token errors - need to get a new token
        logConnectionEvent('Token error detected, reinitializing with new token', { code: errorCode });
        isDeviceReady.value = false;
        isInitializingDevice.value = false;
        cleanupDevice();
        
        // Retry with new token
        setTimeout(async () => {
          await initializeDevice(true);
        }, 1000);
      } else {
        // Other errors
        deviceError.value = errorMessage;
        isDeviceReady.value = false;
        isInitializingDevice.value = false;
        
        // For other connection-related errors, attempt reconnection
        if (errorMessage?.toLowerCase().includes('connection') || 
            errorMessage?.toLowerCase().includes('network') ||
            errorMessage?.toLowerCase().includes('websocket')) {
          if (!isReconnecting.value && !isCalling.value) {
            attemptReconnection();
          }
        }
      }
    });

    // newDevice.on("incoming", () => {
    //   // Handle incoming calls if needed
    // });

    logConnectionEvent('Registering device');
    newDevice.register();
    device.value = markRaw(newDevice);
  } catch (error: any) {
    logConnectionEvent('Failed to initialize device', { error: error.message });
    deviceError.value = error.message || "Failed to initialize device";
    isInitializingDevice.value = false;
    
    // Attempt reconnection for initialization failures
    if (!isReconnecting.value && !isCalling.value) {
      attemptReconnection();
    }
  }
};

const handleCallEnded = () => {
  callStatus.value = "completed";
  isCalling.value = false;
  activeCall.value = null;
  if (currentCall.value) {
    currentCall.value.status = "completed";
  }
  clearPolling();
  invalidateQueries();
};

const startCallMutation = useMutation({
  mutationFn: async (toNumber: string) => {
    return await $fetch("/api/calls/browser-start", {
      method: "POST",
      body: { toNumber },
    });
  },
  onSuccess: async (data) => {
    if (!device.value || !isDeviceReady.value) {
      throw new Error("Device not ready. Please wait a moment and try again.");
    }

    try {
      const call = await device.value.connect({
        params: {
          To: phoneNumber.value,
          CallId: data.callId.toString(),
        },
      });

      activeCall.value = markRaw(call);
      currentCall.value = {
        callId: data.callId,
        twilioCallSid: "",
        status: "ringing",
        maxAllowedSeconds: data.maxAllowedSeconds,
      };
      isCalling.value = true;
      callStatus.value = "ringing";

      call.on("accept", () => {
        callStatus.value = "answered";
        if (currentCall.value) {
          currentCall.value.status = "answered";
        }
        pollCallStatus(data.callId);
      });

      call.on("disconnect", handleCallEnded);

      call.on("cancel", () => {
        callStatus.value = "failed";
        isCalling.value = false;
        activeCall.value = null;
        clearPolling();
      });

      call.on("reject", () => {
        callStatus.value = "failed";
        isCalling.value = false;
        activeCall.value = null;
        clearPolling();
      });

      call.on("error", (error: any) => {
        if (
          error.code === 31005 ||
          error.message?.includes("disconnect") ||
          error.message?.includes("ended")
        ) {
          handleCallEnded();
        }
      });

      pollCallStatus(data.callId);
    } catch (error: any) {
      callStatus.value = "error";
      isCalling.value = false;
      throw error;
    }
  },
  onError: () => {
    callStatus.value = "error";
  },
});

const pollCallStatus = (callId: number) => {
  clearPolling();

  const interval = setInterval(async () => {
    try {
      const calls = await $fetch("/api/calls/history?limit=1");
      const recentCall = calls.calls?.[0];
      
      if (recentCall && recentCall.id === callId) {
        callStatus.value = recentCall.status;
        
        if (currentCall.value) {
          currentCall.value.status = recentCall.status;
          if (recentCall.twilioCallSid && !currentCall.value.twilioCallSid) {
            currentCall.value.twilioCallSid = recentCall.twilioCallSid;
          }
        }

        if (["completed", "failed", "busy", "no-answer"].includes(recentCall.status)) {
          clearInterval(interval);
          pollingInterval.value = null;
          isCalling.value = false;
          activeCall.value = null;
          invalidateQueries();
        }
      }
    } catch (error) {
      // Silently handle polling errors
    }
  }, 2000);

  pollingInterval.value = interval;

  setTimeout(() => {
    if (pollingInterval.value === interval) {
      clearInterval(interval);
      pollingInterval.value = null;
    }
  }, 5 * 60 * 1000);
};

const handleStartCall = async () => {
  if (!isValidPhone.value || isCalling.value || !isDeviceReady.value) return;
  startCallMutation.mutate(phoneNumber.value);
};

const handleInitializeDevice = async () => {
  if (device.value || isInitializingDevice.value) return;
  await initializeDevice();
};

const endCallMutation = useMutation({
  mutationFn: async (data: { callId?: number; twilioCallSid?: string }) => {
    return await $fetch("/api/calls/end", {
      method: "POST",
      body: data,
    });
  },
  onSuccess: () => {
    clearPolling();
    isCalling.value = false;
    callStatus.value = "completed";
    invalidateQueries();
  },
  onError: (error: any) => {
    toast({
      title: "Failed to end call",
      description:
        error?.data?.message ||
        error?.message ||
        "The call was disconnected locally, but server update failed.",
      variant: "destructive",
    });
    clearPolling();
    isCalling.value = false;
    callStatus.value = "completed";
    invalidateQueries();
  },
});

const handleEndCall = () => {
  if (activeCall.value) {
    activeCall.value.disconnect();
    activeCall.value = null;
  }

  if (currentCall.value) {
    const mutationPayload: { callId?: number; twilioCallSid?: string } = {
      callId: currentCall.value.callId,
    };
    if (currentCall.value.twilioCallSid) {
      mutationPayload.twilioCallSid = currentCall.value.twilioCallSid;
    }
    endCallMutation.mutate(mutationPayload);
  }

  isCalling.value = false;
  callStatus.value = "completed";
  clearPolling();
  invalidateQueries();
};

onMounted(async () => {
  const hasPermission = await checkMicrophonePermission();
  if (hasPermission && !device.value && !isInitializingDevice.value) {
    await initializeDevice();
  }
});

onUnmounted(() => {
  cancelReconnection();
  if (activeCall.value) {
    activeCall.value.disconnect();
  }
  cleanupDevice();
  clearPolling();
});
</script>

<template>
  <main
    class="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10"
  >
    <div class="mx-auto w-full max-w-2xl">
      <h1 class="text-3xl font-bold mb-6">Phone Dialer</h1>

      <!-- Wallet Balance -->
      <div class="mb-6 p-4 bg-card rounded-lg border">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">Balance</p>
            <p class="text-2xl font-bold" v-if="!walletLoading">
              ${{ wallet?.balanceUsd?.toFixed(2) || "0.00" }}
            </p>
          </div>
          <UiButton variant="outline" as-child>
            <NuxtLink to="/app/wallet">Manage Wallet</NuxtLink>
          </UiButton>
        </div>
      </div>

      <!-- Initialization Screen -->
      <div v-if="!isDeviceReady" class="p-6 bg-card rounded-lg border">
        <div class="flex flex-col items-center justify-center py-12 space-y-6">
          <div
            v-if="isInitializingDevice"
            class="flex flex-col items-center space-y-4"
          >
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <div class="text-center">
              <p class="text-lg font-medium">Preparing to make calls...</p>
              <p class="text-sm text-muted-foreground mt-2">
                Please allow microphone access when prompted
              </p>
            </div>
          </div>

          <div
            v-else-if="deviceError"
            class="flex flex-col items-center space-y-4 text-center"
          >
            <Icon name="lucide:alert-circle" class="h-12 w-12 text-destructive" />
            <div>
              <p class="text-lg font-medium text-destructive">Unable to initialize</p>
              <p class="text-sm text-muted-foreground mt-2">
                {{ deviceError }}
              </p>
            </div>
            <UiButton @click="handleInitializeDevice" variant="outline">
              Try Again
            </UiButton>
          </div>

          <div
            v-else
            class="flex flex-col items-center space-y-4 text-center"
          >
            <Icon name="lucide:phone" class="h-12 w-12 text-muted-foreground" />
            <div>
              <p class="text-lg font-medium">Ready to start calling</p>
              <p class="text-sm text-muted-foreground mt-2">
                Click the button below to enable calling features
              </p>
            </div>
            <UiButton
              @click="handleInitializeDevice"
              size="lg"
              :disabled="isInitializingDevice"
            >
              <Icon name="lucide:phone" class="mr-2" />
              Enable Calling
            </UiButton>
          </div>
        </div>
      </div>

      <!-- Dialer (shown only when device is ready) -->
      <div v-else class="p-6 bg-card rounded-lg border">
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium mb-2 block">Phone Number</label>
            <UiInput
              v-model="phoneNumber"
              type="tel"
              placeholder="+1234567890"
              :disabled="isCalling"
              class="text-lg"
            />
            <p class="text-xs text-muted-foreground mt-1">
              Enter number in E.164 format (e.g., +1234567890)
            </p>
          </div>

          <div v-if="isValidPhone && wallet" class="p-3 bg-muted rounded space-y-1">
            <div v-if="rateLoading" class="flex items-center gap-2">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <p class="text-sm text-muted-foreground">Fetching rate...</p>
            </div>
            <template v-else-if="callRate">
              <p class="text-sm">
                Rate:
                <strong>${{ userRatePerMin?.toFixed(4) }}/min</strong>
              </p>
              <p class="text-sm">
                Max minutes:
                <strong>{{ remainingMinutes }}</strong>
              </p>
            </template>
            <p v-else-if="rateError" class="text-sm text-destructive">
              Could not fetch rate for this number.
            </p>
          </div>

          <!-- Call Status -->
          <div
            v-if="callStatus"
            class="p-3 rounded"
            :class="{
              'bg-blue-100 dark:bg-blue-900':
                callStatus === 'ringing' || callStatus === 'answered',
              'bg-green-100 dark:bg-green-900': callStatus === 'completed',
              'bg-red-100 dark:bg-red-900': [
                'failed',
                'busy',
                'no-answer',
                'error',
              ].includes(callStatus),
            }"
          >
            <p class="text-sm font-medium">
              Status: <span class="capitalize">{{ callStatus }}</span>
            </p>
            <p v-if="currentCall" class="text-xs text-muted-foreground mt-1">
              Call ID: {{ currentCall.callId }}
              <span v-if="currentCall.twilioCallSid">
                | SID: {{ currentCall.twilioCallSid.substring(0, 20) }}...
              </span>
            </p>
            <p
              v-if="currentCall && currentCall.maxAllowedSeconds"
              class="text-xs text-muted-foreground"
            >
              Max duration:
              {{ Math.floor(currentCall.maxAllowedSeconds / 60) }} minutes
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-2">
            <UiButton
              @click="handleStartCall"
              :disabled="
                !isValidPhone ||
                isCalling ||
                walletLoading ||
                (wallet?.balanceUsd || 0) < 0.01
              "
              class="flex-1"
              size="lg"
            >
              <Icon name="lucide:phone" class="mr-2" />
              {{ isCalling ? "Calling..." : "Start Call" }}
            </UiButton>

            <UiButton
              v-if="isCalling"
              @click="handleEndCall"
              variant="destructive"
              size="lg"
            >
              <Icon name="lucide:phone-off" class="mr-2" />
              {{ endCallMutation.isPending ? "Ending..." : "End Call" }}
            </UiButton>
          </div>

          <p
            v-if="(wallet?.balanceUsd || 0) < 0.01"
            class="text-sm text-destructive"
          >
            Insufficient balance. Please add more funds to make calls.
          </p>
        </div>
      </div>
    </div>
  </main>
</template>
