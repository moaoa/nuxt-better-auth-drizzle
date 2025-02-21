<script lang="ts" setup>
import type { User } from "~~/db/schema";

const emit = defineEmits<{
    refresh: [];
    updateUser: [];
}>();

const { isEditOpen, closeEditUser, userToEdit } = useUser();
const {
    updateUserRole,
    updateUserBan,
    isLoading
} = useUserManagement();

// Reactive state for role and ban actions
const userActions = ref({
    confirmAction: false
});

// Confirmation modal state
const confirmationModal = ref({
    isOpen: false,
    title: '',
    message: ''
});

// Method to open confirmation modal
const openConfirmationModal = () => {
    if (!userToEdit.value) return;

    confirmationModal.value.isOpen = true;
};

// Method to handle confirmed action
const handleConfirmedAction = async () => {
    if (!userToEdit.value) return;

    try {
        await updateUserRole(userToEdit.value.id.toString(), userToEdit.value.role);
        await updateUserBan(userToEdit.value.id.toString(), userToEdit.value.banned);


        // Close modals and emit update
        confirmationModal.value.isOpen = false;
        closeEditUser();
        emit('refresh');
    } catch (error) {
        // Handle error (toast or error message)
        console.error('Update failed', error);
    }
};

</script>

<template>
    <UiDialog :open="isEditOpen" @update:open="closeEditUser" :loading="isLoading">
        <UiDialogContent>
            <UiDialogHeader>
                <UiDialogTitle>Manage User</UiDialogTitle>
                <UiDialogDescription>
                    Modify user role or ban status
                </UiDialogDescription>
            </UiDialogHeader>

            <div v-if="userToEdit" class="space-y-4">
                <!-- Role Management -->
                <div class="mb-4">
                    <UiLabel class="block mb-2">Change User Role</UiLabel>
                    <UiSelect v-model="userToEdit.role">
                        <UiSelectTrigger>
                            <UiSelectValue placeholder="Select role" />
                        </UiSelectTrigger>
                        <UiSelectContent>
                            <UiSelectItem value="user">User</UiSelectItem>
                            <UiSelectItem value="admin">Admin</UiSelectItem>
                        </UiSelectContent>
                    </UiSelect>
                </div>

                <!-- Ban/Unban Management -->
                <div>
                    <UiLabel class="block mb-2">User Status</UiLabel>
                    <div class="flex items-center space-x-2 mt-4">
                        <UiCheckbox v-model:checked="userToEdit.banned" :id="'ban-user-' + userToEdit.id" />
                        <UiLabel :for="'ban-user-' + userToEdit.id">
                            {{ userToEdit.banned ? 'Unban User' : 'Ban User' }}
                        </UiLabel>
                    </div>
                </div>
                <div class="mt-4">
                    <UiLabel class="block mt-2">User verified</UiLabel>
                    <div class="flex items-center space-x-2 mt-4">
                        <UiCheckbox v-model:checked="userToEdit.emailVerified" :id="'status-user-' + userToEdit.id" />
                        <UiLabel :for="'status-user-' + userToEdit.id">
                            {{ userToEdit.emailVerified ? 'Active' : 'Inactive' }}
                        </UiLabel>
                    </div>
                </div>
            </div>
            <UiDialogFooter>
                <UiButton variant="default" class="mt-2" @click="openConfirmationModal">
                    Save Changes
                </UiButton>
            </UiDialogFooter>
        </UiDialogContent>
    </UiDialog>

    <!-- Confirmation Modal -->
    <UiDialog :open="confirmationModal.isOpen" @update:open="confirmationModal.isOpen = false">
        <UiDialogContent>
            <UiDialogHeader>
                <UiDialogTitle>Save Changes</UiDialogTitle>
                <UiDialogDescription>
                    Confirm the changes made to the user
                </UiDialogDescription>
            </UiDialogHeader>

            <div class="flex justify-end space-x-2">
                <UiButton variant="outline" @click="confirmationModal.isOpen = false">
                    Cancel
                </UiButton>
                <UiButton :variant="'default'" @click="handleConfirmedAction">
                    Confirm
                </UiButton>
            </div>
        </UiDialogContent>
    </UiDialog>
</template>