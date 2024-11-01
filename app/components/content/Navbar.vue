<script lang="ts" setup>
/**
 *
 * Component Description:Desc
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const mode = useColorMode();

const isOpen = ref<boolean>(false);

const { data } = await useAsyncData("nav_en", () =>
  queryContent("/").where({ _partial: true, title: "nav" }).findOne()
);
</script>

<template>
  <section
    class="w-[90%] md:w-[70%] lg:w-[75%] lg:max-w-full mx-auto top-0 sticky border z-40 rounded-b-2xl flex justify-between items-center p-2 bg-card bg-blend-difference shadow-md"
    :class="{
      'shadow-light': mode.value === 'light',
      'shadow-dark': mode.value === 'dark',
    }"
  >
    <header
      :class="{
        'w-[90%] md:w-[70%] lg:w-[75%] lg:max-w-screen-2xl mx-auto sticky z-40  flex justify-between items-center p-2 ': true,
      }"
    >
      <NuxtLink href="/" class="font-bold text-lg flex items-center">
        <Icon
          name="lucide:arrow-down"
          class="bg-gradient-to-tr from-primary via-primary/70 to-primary rounded-lg w-9 h-9 mr-2 border text-white"
        />
        ShadcnVue
      </NuxtLink>
      <!-- Mobile -->
      <div class="flex items-center lg:hidden">
        <UiSheet v-model:open="isOpen">
          <UiSheetTrigger as-child as="div">
            <Icon name="lucide:menu" class="cursor-pointer" @click="isOpen = true" />
          </UiSheetTrigger>

          <UiSheetContent
            side="left"
            class="flex flex-col justify-between rounded-tr-2xl rounded-br-2xl bg-card"
          >
            <div>
              <UiSheetHeader class="mb-4 ml-4">
                <UiSheetTitle class="flex items-center">
                  <NuxtLink href="/" class="flex items-center">
                    <Icon
                      name="lucide:arrow-left"
                      class="bg-gradient-to-tr from-primary/70 via-primary to-primary/70 rounded-lg size-9 mr-2 border text-white"
                    />
                    ShadcnVue
                  </NuxtLink>
                </UiSheetTitle>
              </UiSheetHeader>

              <div class="flex flex-col gap-2">
                <UiButton
                  v-for="{ href, name } in data.ShortLinks"
                  :key="name"
                  as-child
                  variant="ghost"
                  class="justify-start text-base"
                >
                  <NuxtLink :href="href" @click="isOpen = false">
                    {{ name }}
                  </NuxtLink>
                </UiButton>
              </div>
            </div>

            <UiSheetFooter class="flex-col sm:flex-col justify-start items-start">
              <UiSeparator class="mb-2" />

              <ToggleTheme />
            </UiSheetFooter>
          </UiSheetContent>
        </UiSheet>
      </div>

      <!-- Desktop -->
      <UiNavigationMenu class="hidden lg:block">
        <UiNavigationMenuList>
          <UiNavigationMenuItem v-for="menuLink in data.MenuLinks" :key="menuLink.name">
            <template v-if="!menuLink.children">
              <UiNavigationMenuLink as-child>
                <UiButton as-child variant="ghost" class="justify-start text-base">
                  <NuxtLink :href="menuLink.href" prefetch>
                    {{ menuLink.name }}
                  </NuxtLink>
                </UiButton>
              </UiNavigationMenuLink>
            </template>
            <template v-else>
              <UiNavigationMenuTrigger class="bg-card text-base">
                {{ menuLink.name }}
              </UiNavigationMenuTrigger>
              <UiNavigationMenuContent>
                <div
                  class="grid grid-cols-1 gap-5 bg-background p-6 py-5 ring-1 ring-muted lg:w-[750px] lg:grid-cols-2 xl:w-[1000px] xl:grid-cols-3"
                >
                  <NuxtImg
                    :src="menuLink.image"
                    alt="Beach"
                    class="h-full w-full rounded-md object-cover"
                  />
                  <div
                    v-for="(item, index) in menuLink.children"
                    :key="`${item.name}-${index}`"
                  >
                    <p class="mb-5 text-sm font-semibold capitalize text-primary">
                      {{ item.name }}
                    </p>
                    <ul class="flex w-full flex-col gap-2">
                      <li v-for="(child, k) in item.children" :key="k">
                        <UiNavigationMenuLink class="data-[active]:bg-muted/80" as-child>
                          <NuxtLink
                            :to="child.href"
                            class="flex gap-4 rounded-md p-3 transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            <Icon
                              v-if="child.icon"
                              :name="child.icon"
                              class="mt-px h-5 w-5 shrink-0 text-primary"
                            />
                            <div class="flex flex-col gap-1.5 leading-none">
                              <p class="text-sm font-semibold">
                                {{ child.name }}
                              </p>
                              <p
                                class="text-sm text-muted-foreground"
                                v-html="child.description"
                              />
                            </div>
                          </NuxtLink>
                        </UiNavigationMenuLink>
                      </li>
                    </ul>
                  </div>
                </div>
              </UiNavigationMenuContent>
            </template>
          </UiNavigationMenuItem>
        </UiNavigationMenuList>
      </UiNavigationMenu>

      <div class="hidden lg:flex">
        <ToggleTheme />

        <UiButton as-child size="sm" variant="ghost" aria-label="View on GitHub">
          <NuxtLink
            aria-label="View on GitHub"
            href="https://github.com/leoMirandaa/shadcn-vue-landing-page.git"
            target="_blank"
          >
            <Icon name="mdi:github" />
          </NuxtLink>
        </UiButton>
        <UiButton as-child size="sm" variant="ghost" aria-label="View on GitHub">
          <NuxtLink aria-label="Login" to="/login"> Login </NuxtLink>
        </UiButton>
        <UiButton as-child size="sm" variant="ghost" aria-label="Register">
          <NuxtLink aria-label="Register" to="/register"> Register </NuxtLink>
        </UiButton>
      </div>
    </header>
  </section>
</template>

<style scoped>
.shadow-light {
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.085);
}

.shadow-dark {
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.141);
}
</style>
