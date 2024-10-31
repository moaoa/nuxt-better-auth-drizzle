<script lang="ts" setup>
import { signUp } from "~~/lib/auth-client";
/**
 *
 * Register view
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const userInformation = ref({
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  password_confirm: "",
});

const registerForm = computed(() => [
  {
    $cmp: "FormKit",
    props: {
      type: "text",
      name: "firstName",
      label: "First name",
      validation: "required",
    },
  },
  {
    $formkit: "text",
    name: "lastName",
    label: "Last name",
    validation: "required|length:3,30",
  },
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
  {
    $formkit: "password",
    name: "password_confirm",
    label: "Confirm password",
    help: "Enter your new password again to confirm it.",
    validation: "required|confirm",
    validationLabel: "password confirmation",
  },
]);

const HandleRegisterUser = async () => {
  await signUp.email({
    email: userInformation.value.email,
    password: userInformation.value.password,
    name: `${userInformation.value.firstName} ${userInformation.value.lastName}`
      .toUpperCase()
      .replaceAll(" ", "-"),
    firstName: userInformation.value.firstName,
    lastName: userInformation.value.lastName,
    callbackURL: "/app/",
    fetchOptions: {
      onError: (err) => console.log(err),
    },
  });
};
</script>

<template>
  <div class="container py-24">
    <Card class="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle class="text-2xl"> Register </CardTitle>
        <CardDescription> Enter your details to create your account. </CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <FormKit
          id="register-form"
          v-slot="{ state: { valid } }"
          v-model="userInformation"
          type="form"
          :actions="false"
          @submit="HandleRegisterUser"
        >
          <FormKitSchema :schema="registerForm" />

          <Button class="w-full" type="submit" :disabled="!valid"> Register </Button>
        </FormKit>
        <Separator />
        <Button variant="ghost" class="w-full">
          <NuxtLink to="/login">
            Already have an account?
            <span class="underline">Login</span>
          </NuxtLink>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
<style scoped></style>
