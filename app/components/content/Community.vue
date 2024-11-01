<script setup lang="ts">

</script>

<template>
  <section
    id="community"
    class="py-12"
  >
    <hr >
    <div class="container py-20 sm:py-20">
      <div class="lg:w-[60%] mx-auto">
        <UiCard
          class="bg-background shadow-none text-center flex flex-col items-center justify-center border-0"
        >
          <UiCardHeader>
            <UiCardTitle class="text-4xl md:text-5xl font-bold">
              <Icon
                class="w-20 h-20 m-auto mb-4"
                name="lucide:discord"
              />
              Ready to join this
              <span
                class="text-transparent bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text"
              >
                Community?
              </span>
            </UiCardTitle>
          </UiCardHeader>
          <UiCardContent class="lg:w-[80%] text-xl text-muted-foreground">
            Join our vibrant Discord community! Connect, share, and grow with
            like-minded enthusiasts. Click to dive in! 🚀
          </UiCardContent>

          <UiCardFooter>
            <UiButton as-child>
              <a
                href="https://discord.com/"
                target="_blank"
              >
                Join Discord
              </a>
            </UiButton>
          </UiCardFooter>
        </UiCard>
      </div>
    </div>
    <hr >
  </section>
</template>
