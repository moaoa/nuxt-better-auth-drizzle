<script lang="ts" setup>
import type { User } from "~~/db/schema";

const { isCreateOpen, closeCreateUser } = useUser();
const { createUserAsAdmin, isLoading } = useUserManagement();

const userForm = ref<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>({
  email: "",
  name: "",
  firstName: "",
  lastName: "",
  role: "user",
  image: "",
  banned: false,
  emailVerified: false,
  // @ts-ignore
  password: "",

});

const userFormSchema = [
  {
    $formkit: "text",
    name: "email",
    label: "Email",
    validation: "required|email",
    placeholder: "Enter email address"
  },
  {
    $formkit: "text",
    name: "name",
    label: "Name",
    validation: "required|length:2,50",
    placeholder: "Enter first name"
  },
  {
    $formkit: "text",
    name: "firstName",
    label: "First Name",
    validation: "required|length:2,50",
    placeholder: "Enter first name"
  },
  {
    $formkit: "text",
    name: "lastName",
    label: "Last Name",
    validation: "required|length:2,50",
    placeholder: "Enter last name"
  },
  {
    $formkit: "password",
    name: "password",
    label: "Password",
    validation: "required|length:8,32",
    placeholder: "Enter password"
  },
  {
    $formkit: "select",
    name: "role",
    label: "Role",
    options: [
      { label: "User", value: "user" },
      { label: "Admin", value: "admin" }
    ],
    validation: "required"
  },
  {
    $formkit: "text",
    name: "image",
    label: "Image",
    validation: "url",
    placeholder: "Enter image URL"
  },
  {
    $formkit: "checkbox",
    name: "banned",
    label: "Banned",
    decoratorIcon: "sad"
  },
  {
    $formkit: "checkbox",
    name: "emailVerified",
    label: "Email Verified",
    decoratorIcon: "happy"
  },
];

const handleCreateUser = async () => {
  // Implementation of user creation logic here
  await createUserAsAdmin(userForm.value as any);
  userForm.value = {
    email: "",
    name: "",
    firstName: "",
    lastName: "",
    role: "user",
    image: "",
    banned: false,
    emailVerified: false,
    // @ts-ignore
    password: "",
  };
  closeCreateUser();
  emit("refresh");
};

</script>

<template>
  <UiDialog :open="isCreateOpen" @update:open="closeCreateUser" :loading="isLoading">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>Create New User</UiDialogTitle>
        <UiDialogDescription>
          Fill in the details to create a new user
        </UiDialogDescription>
      </UiDialogHeader>

      <FormKit id="create-user-form" v-slot="{ state: { valid } }" v-model="userForm" type="form" :actions="false"
        @submit="handleCreateUser">
        <FormKitSchema :schema="userFormSchema" />

        <div class="flex justify-end gap-3 mt-4">
          <UiButton type="button" variant="outline" @click="closeCreateUser">
            Cancel
          </UiButton>
          <UiButton type="submit" :disabled="!valid" :loading="isLoading">
            Create User
          </UiButton>
        </div>
      </FormKit>
    </UiDialogContent>
  </UiDialog>
</template>
