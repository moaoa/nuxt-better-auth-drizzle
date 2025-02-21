<script lang="ts" setup>
import { useToast } from "~/components/ui/toast/use-toast";

const props = defineProps<{
  userId: string;
  username: string;
}>();
const emit = defineEmits<{
  refresh: [];
  deleteUser: []
}>();

const { isDeleteOpen, isLoading, closeDeleteUser } = useUser();

const handleDelete = async () => {
  emit("deleteUser");
};

</script>

<template>
  <UiDialog :open="isDeleteOpen" @update:open="closeDeleteUser">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>Delete User</UiDialogTitle>
        <UiDialogDescription>
          Are you sure you want to delete the user "{{ username }}"?
          This action cannot be undone.
        </UiDialogDescription>
      </UiDialogHeader>
      <div class="flex justify-end gap-3 mt-4">
        <UiButton type="button" variant="outline" @click="closeDeleteUser">
          Cancel
        </UiButton>
        <UiButton type="button" variant="destructive" :loading="isLoading" @click="handleDelete">
          Delete User
        </UiButton>
      </div>
    </UiDialogContent>
  </UiDialog>
</template>
