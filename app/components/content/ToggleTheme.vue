<script setup lang="ts">
const colorMode = useColorMode();

const HandleThemeChange = () => {
  console.log("mode", colorMode.value);
  
  colorMode.preference = colorMode.value === "light" ? "dark" : "light";
};
</script>

<template>
  <Button
    size="sm"
    variant="ghost"
    class="w-full justify-start"
    @click="HandleThemeChange"
  >
    <div
      v-if="$colorMode.value == 'light'"
      class="flex gap-2"
    >
      <Icon  name="lucide:moon" class="size-5" />
      <span class="block lg:hidden"> Dark </span>
    </div>

    <div
      v-else
      class="flex gap-2"
    >
      <Icon  name="lucide:sun" class="size-5" />
      <span class="block lg:hidden">Light</span>
    </div>

    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
