<script lang="ts" setup>
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { isValidPhoneNumber } from "libphonenumber-js";
import { Device, Call } from "@twilio/voice-sdk";

const queryClient = useQueryClient();

// Fetch wallet balance
const { data: wallet, isLoading: walletLoading } = useQuery({
  queryKey: ["wallet"],
  queryFn: async () => {
    const response = await $fetch("/api/wallet");
    return response;
  },
});

// Phone number input
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

// Twilio Voice SDK
const device = ref<Device | null>(null);
const activeCall = ref<Call | null>(null);
const isDeviceReady = ref(false);
const deviceError = ref<string | null>(null);
const isInitializingDevice = ref(false);

// Validate E.164 format - supports all countries including Libya (+218)
const isValidPhone = computed(() => {
  if (!phoneNumber.value) return false;

  // First check basic E.164 format: +[country code][number] (max 15 digits after +)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(phoneNumber.value)) {
    return false;
  }

  // Then validate using libphonenumber-js to ensure it's a valid phone number
  // This properly validates Libyan numbers (+218) and all other countries
  try {
    return isValidPhoneNumber(phoneNumber.value);
  } catch {
    return false;
  }
});

// Calculate remaining minutes (rough estimate)
const remainingMinutes = computed(() => {
  if (!wallet.value || !isValidPhone.value) return 0;
  // Rough estimate: assume $0.01 per minute
  const creditsPerMinute = 100; // 1 credit = $0.01, so 100 credits = $1 = 100 minutes at $0.01/min
  return Math.floor(wallet.value.balanceCredits / creditsPerMinute);
});

// Initialize Twilio Device (must be called after user gesture)
const initializeDevice = async () => {
  // Prevent multiple initialization attempts
  if (device.value || isInitializingDevice.value) {
    return;
  }

  isInitializingDevice.value = true;
  deviceError.value = null;

  try {
    // Get access token from server
    const tokenResponse = await $fetch("/api/twilio/token");
    const { token } = tokenResponse;

    // Create new device
    const newDevice = new Device(token);

    // Set up device event listeners
    newDevice.on("registered", () => {
      console.log("Twilio Device registered");
      isDeviceReady.value = true;
      deviceError.value = null;
      isInitializingDevice.value = false;
    });

    newDevice.on("error", (error: any) => {
      console.error("Twilio Device error:", error);
      deviceError.value = error.message || "Device error";
      isDeviceReady.value = false;
      isInitializingDevice.value = false;
    });

    newDevice.on("incoming", (call: Call) => {
      console.log("Incoming call:", call);
      // Handle incoming calls if needed
    });

    // Register the device
    newDevice.register();
    device.value = newDevice;
  } catch (error: any) {
    console.error("Failed to initialize device:", error);
    deviceError.value = error.message || "Failed to initialize device";
    isInitializingDevice.value = false;
  }
};

// Start browser call mutation
const startCallMutation = useMutation({
  mutationFn: async (toNumber: string) => {
    // First create call record
    const callData = await $fetch("/api/calls/browser-start", {
      method: "POST",
      body: { toNumber },
    });

    return callData;
  },
  onSuccess: async (data) => {
    if (!device.value || !isDeviceReady.value) {
      throw new Error("Device not ready. Please wait a moment and try again.");
    }

    try {
      // Make the call from browser using Twilio Voice SDK
      const call = await device.value.connect({
        params: {
          To: phoneNumber.value,
          // Pass callId so webhook can update the correct record
          CallId: data.callId.toString(),
        },
      });

      activeCall.value = call;
      currentCall.value = {
        callId: data.callId,
        twilioCallSid: "", // Will be updated by webhook
        status: "ringing",
        maxAllowedSeconds: data.maxAllowedSeconds,
      };
      isCalling.value = true;
      callStatus.value = "ringing";

      // Set up call event listeners
      call.on("accept", () => {
        console.log("Call accepted");
        callStatus.value = "answered";
        if (currentCall.value) {
          currentCall.value.status = "answered";
        }
        // Start polling for call updates
        pollCallStatus(data.callId);
      });

      call.on("disconnect", () => {
        console.log("Call disconnected");
        callStatus.value = "completed";
        isCalling.value = false;
        activeCall.value = null;
        if (currentCall.value) {
          currentCall.value.status = "completed";
        }
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        queryClient.invalidateQueries({ queryKey: ["calls"] });
      });

      call.on("cancel", () => {
        console.log("Call cancelled");
        callStatus.value = "failed";
        isCalling.value = false;
        activeCall.value = null;
      });

      call.on("reject", () => {
        console.log("Call rejected");
        callStatus.value = "failed";
        isCalling.value = false;
        activeCall.value = null;
      });

      // Poll for call status updates (webhook updates)
      pollCallStatus(data.callId);
    } catch (error: any) {
      console.error("Failed to make call:", error);
      callStatus.value = "error";
      isCalling.value = false;
      throw error;
    }
  },
  onError: (error: any) => {
    callStatus.value = "error";
    console.error("Call failed:", error);
  },
});

// Poll call status
const pollCallStatus = (callId: number) => {
  // Clear any existing interval
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
  }

  const interval = setInterval(async () => {
    try {
      const calls = await $fetch("/api/calls/history?limit=1");
      const recentCall = calls.calls?.[0];
      if (recentCall && recentCall.id === callId) {
        callStatus.value = recentCall.status;
        // Update current call status
        if (currentCall.value) {
          currentCall.value.status = recentCall.status;
        }

        if (
          ["completed", "failed", "busy", "no-answer"].includes(
            recentCall.status
          )
        ) {
          clearInterval(interval);
          pollingInterval.value = null;
          isCalling.value = false;
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
          queryClient.invalidateQueries({ queryKey: ["calls"] });
        }
      }
    } catch (error) {
      console.error("Error polling call status:", error);
    }
  }, 2000);

  pollingInterval.value = interval;

  // Stop polling after 5 minutes
  setTimeout(() => {
    if (pollingInterval.value === interval) {
      clearInterval(interval);
      pollingInterval.value = null;
    }
  }, 5 * 60 * 1000);
};

const handleStartCall = async () => {
  if (!isValidPhone.value || isCalling.value) return;

  // Initialize device on first user interaction (required for AudioContext)
  if (!device.value && !isInitializingDevice.value) {
    await initializeDevice();
    // Wait a bit for device to register
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Wait for device to be ready
  if (!isDeviceReady.value) {
    deviceError.value = "Device is not ready. Please wait...";
    return;
  }

  startCallMutation.mutate(phoneNumber.value);
};

// End call mutation
const endCallMutation = useMutation({
  mutationFn: async (data: { callId?: number; twilioCallSid?: string }) => {
    return await $fetch("/api/calls/end", {
      method: "POST",
      body: data,
    });
  },
  onSuccess: () => {
    // Clear polling
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value);
      pollingInterval.value = null;
    }
    isCalling.value = false;
    callStatus.value = "completed";
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    queryClient.invalidateQueries({ queryKey: ["calls"] });
  },
  onError: (error: any) => {
    console.error("Failed to end call:", error);
  },
});

const handleEndCall = () => {
  // Disconnect the active call from browser
  if (activeCall.value) {
    activeCall.value.disconnect();
    activeCall.value = null;
  }

  // Also update server if we have call info
  if (currentCall.value) {
    if (currentCall.value.twilioCallSid) {
      endCallMutation.mutate({
        callId: currentCall.value.callId,
        twilioCallSid: currentCall.value.twilioCallSid,
      });
    }
  }

  // Clear local state
  isCalling.value = false;
  callStatus.value = "completed";

  // Clear polling
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
    pollingInterval.value = null;
  }

  queryClient.invalidateQueries({ queryKey: ["wallet"] });
  queryClient.invalidateQueries({ queryKey: ["calls"] });
};

// Note: Device initialization is deferred until user interaction
// This is required because browsers block AudioContext until user gesture

// Cleanup on unmount
onUnmounted(() => {
  if (activeCall.value) {
    activeCall.value.disconnect();
  }
  if (device.value) {
    device.value.destroy();
  }
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
  }
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
            <p class="text-sm text-muted-foreground" v-if="!walletLoading">
              {{ wallet?.balanceCredits || 0 }} credits
            </p>
          </div>
          <UiButton variant="outline" as-child>
            <NuxtLink to="/app/wallet">Manage Wallet</NuxtLink>
          </UiButton>
        </div>
      </div>

      <!-- Dialer -->
      <div class="p-6 bg-card rounded-lg border">
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
              Enter number in E.164 format (e.g., +1234567890 or +218XXXXXXXXX
              for Libya)
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
              Call ID: {{ currentCall.callId }} | SID:
              {{ currentCall.twilioCallSid.substring(0, 20) }}...
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
                isInitializingDevice ||
                (wallet?.balanceCredits || 0) < 100
              "
              class="flex-1"
              size="lg"
            >
              <Icon name="lucide:phone" class="mr-2" />
              {{
                isCalling
                  ? "Calling..."
                  : isInitializingDevice
                  ? "Initializing..."
                  : "Start Call"
              }}
            </UiButton>

            <UiButton
              v-if="isCalling"
              @click="handleEndCall"
              :disabled="endCallMutation.isPending"
              variant="destructive"
              size="lg"
            >
              <Icon name="lucide:phone-off" class="mr-2" />
              {{ endCallMutation.isPending ? "Ending..." : "End Call" }}
            </UiButton>
          </div>

          <!-- Device Status -->
          <div
            v-if="isInitializingDevice"
            class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded text-sm"
          >
            <p>Initializing calling service...</p>
          </div>
          <div
            v-else-if="deviceError"
            class="p-2 bg-red-100 dark:bg-red-900 rounded text-sm text-destructive"
          >
            <p>Device error: {{ deviceError }}</p>
          </div>
          <div
            v-else-if="isDeviceReady"
            class="p-2 bg-green-100 dark:bg-green-900 rounded text-sm"
          >
            <p>✓ Ready to make calls</p>
          </div>
          <div v-else class="p-2 bg-blue-100 dark:bg-blue-900 rounded text-sm">
            <p>
              Click "Start Call" to enable calling (requires browser permission)
            </p>
          </div>

          <p
            v-if="(wallet?.balanceCredits || 0) < 100"
            class="text-sm text-destructive"
          >
            Insufficient credits. Please purchase more credits to make calls.
          </p>
        </div>
      </div>
    </div>
  </main>
</template>
