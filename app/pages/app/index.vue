<script lang="ts" setup>
/**
 *
 * Only user that are authenticated can access this page
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { signOut } from "~~/lib/auth-client";
import { useNotionAuth } from "~~/composables/useNotionAuth";

const { initiateAuth } = useNotionAuth();
const router = useRouter();

const HandleSingOut = async () => {
  await signOut();
  router.push("/login");
};

// const { data: session, isPending, error } = await useSession(useFetch);
</script>

<template>
  <div>
    <UiButton
      class="px-5 py-3 border border-slate-400 rounded-lg"
      @click="HandleSingOut"
    >
      Logout
    </UiButton>

    <div class="space-y-4">
      <div class="p-6 rounded-lg shadow">
        <h2 class="text-xl font-semibold mb-4">Notion Integration</h2>
        <button
          @click="initiateAuth"
          class="bg-white text-black px-4 py-2 rounded transition-colors"
        >
          Connect Notion Workspace
        </button>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
