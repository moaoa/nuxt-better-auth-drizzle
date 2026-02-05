<script lang="ts" setup>
import { markRaw, shallowRef, onMounted } from "vue";
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

const remainingMinutes = computed(() => {
  if (!wallet.value || !isValidPhone.value) return 0;
  // TODO: get the rate per minute from the server and apply profit margin
  // For now, return 0 as this would require server-side calculation
  return 0;
});

const invalidateQueries = () => {
  queryClient.invalidateQueries({ queryKey: ["wallet"] });
  queryClient.invalidateQueries({ queryKey: ["calls"] });
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

const initializeDevice = async () => {
  if (device.value || isInitializingDevice.value) return;

  isInitializingDevice.value = true;
  deviceError.value = null;

  try {
    const { token } = await $fetch("/api/twilio/token");
    
    if (!token || typeof token !== "string" || token.length === 0) {
      throw new Error("Invalid token: token is empty or not a string");
    }

    const newDevice = new Device(token);

    newDevice.on("registered", () => {
      isDeviceReady.value = true;
      deviceError.value = null;
      isInitializingDevice.value = false;
    });

    newDevice.on("error", (error: any) => {
      deviceError.value = error.message || "Device error";
      isDeviceReady.value = false;
      isInitializingDevice.value = false;
    });

    // newDevice.on("incoming", () => {
    //   // Handle incoming calls if needed
    // });

    newDevice.register();
    device.value = markRaw(newDevice);
  } catch (error: any) {
    deviceError.value = error.message || "Failed to initialize device";
    isInitializingDevice.value = false;
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
  if (activeCall.value) {
    activeCall.value.disconnect();
  }
  if (device.value) {
    device.value.destroy();
  }
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

          <div v-if="isValidPhone && wallet" class="p-3 bg-muted rounded">
            <p class="text-sm">
              Estimated remaining minutes:
              <strong>{{ remainingMinutes }}</strong>
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
