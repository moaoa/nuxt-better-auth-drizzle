<script setup lang="ts">
import { serviceKeyRouteMap } from "~~/lib/utils";

const { data } = await useFetch("/api/automation-types");

const automationTypes = data.value?.automationTypes || [];

type Key = keyof typeof serviceKeyRouteMap;
</script>

<template>
  <div
    class="container mx-auto py-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
  >
    <div
      v-for="{
        name,
        icon,
        description,
        automationTypeKey,
        disabled,
      } in automationTypes.filter((item) => !item.isHidden)"
      :key="name"
      class="bg-muted/60 dark:bg-card h-full relative rounded-lg p-4"
    >
      <RouterLink
        :disabled="disabled"
        :to="serviceKeyRouteMap[automationTypeKey as Key]"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <Icon
              :name="icon ?? 'lucide:shield-question'"
              class="h-7 w-7 text-accent"
            />
            <h3 class="text-xl font-semibold mb-0 ml-2">{{ name }}</h3>
            <h3 class="text-xl font-semibold mb-0 ml-2">
              {{ automationTypeKey }}
            </h3>
          </div>
          <Icon
            v-if="icon === 'lucide:shield-question'"
            name="lucide:shield-check"
            class="text-accent"
          />
          <Icon
            v-else-if="icon === 'lucide:stop-circle'"
            name="lucide:stop-circle-fill"
            class="text-error"
          />
        </div>
      </RouterLink>
      <p class="text-sm text-muted-foreground">{{ description }}</p>
    </div>
  </div>
</template>
