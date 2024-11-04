<script lang="ts" setup>
import { signIn } from "~~/lib/auth-client";
/**
 *
 * Login view
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const loginForm = ref({
  email: "",
  password: "",
});

const loginFormSchema = [
  {
    $formkit: "text",
    name: "email",
    label: "Email",
    validation: "required|email",
  },
  {
    $formkit: "password",
    name: "password",
    label: "Password",
    validation: "required|length:5,16",
  },
];

const HandleLoginUser = async () => {
  await signIn.email({
    email: loginForm.value.email,
    password: loginForm.value.password,
    callbackURL: "/app/",
    fetchOptions: {
      onError: (err) => console.log(err),
    },
  });
};
</script>

<template>
  <div class="grid place-content-center min-h-screen">
    <UiCard class="w-full max-w-sm">
      <UiCardHeader>
        <UiCardTitle class="text-2xl"> Login </UiCardTitle>
        <UiCardDescription>
          Enter your email below to login to your account.
        </UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="grid gap-4">
        <FormKit id="login-form" v-slot="{ state: { valid } }" v-model="loginForm" type="form" :actions="false"
          @submit="HandleLoginUser">
          <FormKitSchema :schema="loginFormSchema" />
          <UiButton class="w-full" type="submit" :disabled="!valid"> Sign in </UiButton>
        </FormKit>
        <UiSeparator />
        <UiButton variant="ghost" class="w-full">
          <NuxtLink to="/register">
            Don't have an account?
            <span class="underline">Register</span>
          </NuxtLink>
        </UiButton>
      </UiCardContent>
    </UiCard>
  </div>
</template>
<style scoped></style>
