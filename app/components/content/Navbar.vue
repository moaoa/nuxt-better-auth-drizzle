<script lang="ts" setup>

const mode = useColorMode();

interface RouteProps {
  href: string;
  label: string;
}

interface FeatureProps {
  title: string;
  description: string;
}

const routeList: RouteProps[] = [
  {
    href: "#testimonials",
    label: "Testimonials",
  },
  {
    href: "#team",
    label: "Team",
  },
  {
    href: "#contact",
    label: "Contact",
  },
  {
    href: "#faq",
    label: "FAQ",
  },
];

const featureList: FeatureProps[] = [
  {
    title: "Showcase Your Value ",
    description: "Highlight how your product solves user problems.",
  },
  {
    title: "Build Trust",
    description:
      "Leverages social proof elements to establish trust and credibility.",
  },
  {
    title: "Capture Leads",
    description:
      "Make your lead capture form visually appealing and strategically.",
  },
];

const isOpen = ref<boolean>(false);

</script>

<template>
  <section
  class="w-[90%] md:w-[70%] lg:w-[75%] lg:max-w-full mx-auto top-0 sticky border z-40 rounded-b-2xl flex justify-between items-center p-2 bg-card  bg-blend-difference shadow-md"
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
      <NuxtLink
        href="/"
        class="font-bold text-lg flex items-center"
      >
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
            <Icon
              name="lucide:menu"
              class="cursor-pointer"
              @click="isOpen = true"
            />
          </UiSheetTrigger>

          <UiSheetContent
            side="left"
            class="flex flex-col justify-between rounded-tr-2xl rounded-br-2xl bg-card"
          >
            <div>
              <UiSheetHeader class="mb-4 ml-4">
                <UiSheetTitle class="flex items-center">
                  <NuxtLink
                    href="/"
                    class="flex items-center"
                  >
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
                  v-for="{ href, label } in routeList"
                  :key="label"
                  as-child
                  variant="ghost"
                  class="justify-start text-base"
                >
                  <NuxtLink
                    :href="href"
                    @click="isOpen = false"
                  >
                    {{ label }}
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
          <UiNavigationMenuItem>
            <UiNavigationMenuTrigger class="bg-card text-base">
              Features
            </UiNavigationMenuTrigger>
            <UiNavigationMenuContent>
              <div class="grid w-[600px] grid-cols-2 gap-5 p-4">
                <NuxtImg
                  src="https://www.radix-vue.com/logo.svg"
                  alt="Beach"
                  class="h-full w-full rounded-md object-cover"
                />
                <ul class="flex flex-col gap-2">
                  <li
                    v-for="{ title, description } in featureList"
                    :key="title"
                    class="rounded-md p-3 text-sm hover:bg-muted"
                  >
                    <p class="mb-1 font-semibold leading-none text-foreground">
                      {{ title }}
                    </p>
                    <p class="line-clamp-2 text-muted-foreground">
                      {{ description }}
                    </p>
                  </li>
                </ul>
              </div>
            </UiNavigationMenuContent>
          </UiNavigationMenuItem>

          <UiNavigationMenuItem>
            <UiNavigationMenuLink as-child>
              <UiButton
                v-for="{ href, label } in routeList"
                :key="label"
                as-child
                variant="ghost"
                class="justify-start text-base"
              >
                <NuxtLink :href="href" prefetch >
                  {{ label }}
                </NuxtLink>
              </UiButton>
            </UiNavigationMenuLink>
          </UiNavigationMenuItem>
        </UiNavigationMenuList>
      </UiNavigationMenu>

      <div class="hidden lg:flex">
        <ToggleTheme />

        <UiButton
          as-child
          size="sm"
          variant="ghost"
          aria-label="View on GitHub"
        >
          <NuxtLink
            aria-label="View on GitHub"
            href="https://github.com/leoMirandaa/shadcn-vue-landing-page.git"
            target="_blank"
          >
          <Icon name="mdi:github" />
          </NuxtLink>
        </UiButton>
        <UiButton
          as-child
          size="sm"
          variant="ghost"
          aria-label="View on GitHub"
        >
          <NuxtLink
            aria-label="Login"
            to="/login"
          >
          Login
          </NuxtLink>
        </UiButton>
        <UiButton
          as-child
          size="sm"
          variant="ghost"
          aria-label="Register"
        >
          <NuxtLink
            aria-label="Register"
            to="/register"
          >
          Register
          </NuxtLink>
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
