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
    help: "This will be used for your account.",
    validation: "required|email",
  },
  {
    $formkit: "password",
    name: "password",
    label: "Password",
    help: "Enter your new password.",
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
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle class="text-2xl"> Login </CardTitle>
        <CardDescription>
          Enter your email below to login to your account.
        </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <FormKit
          id="login-form"
          v-slot="{ state: { valid } }"
          v-model="loginForm"
          type="form"
          :actions="false"
          @submit="HandleLoginUser"
        >
          <FormKitSchema :schema="loginFormSchema" />
          <Button class="w-full" type="submit" :disabled="!valid"> Sign in </Button>
        </FormKit>
        <Separator />
        <Button variant="ghost" class="w-full">
          <NuxtLink to="/register">
            Don't have an account?
            <span class="underline">Register</span>
          </NuxtLink>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
<style scoped></style>
