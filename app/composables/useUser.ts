import type { User } from "~~/db/schema";

const isEditOpen = ref(false);
const isCreateOpen = ref(false);
const isDeleteOpen = ref(false);
const isLoading = ref(false);
const userToEdit = ref<User | null>(null);

export const useUser = () => {

    const closeOtherModals = () => {
        userToEdit.value = null;
        isEditOpen.value = false;
        isDeleteOpen.value = false;
        isCreateOpen.value = false;
    };


    const openEditUser = (user: User) => {
        closeOtherModals();
        userToEdit.value = user;
        isEditOpen.value = true;
    };

    const closeEditUser = () => {
        isEditOpen.value = false;
        userToEdit.value = null;
    };

    const openDeleteUser = () => {
        closeOtherModals();
        isDeleteOpen.value = true;
    };

    const closeDeleteUser = () => {
        isDeleteOpen.value = false;
    };

    const openAddUser = () => {
        closeOtherModals();
        isCreateOpen.value = true;
    };
    const closeCreateUser = () => {
        closeOtherModals();
        isCreateOpen.value = false;
    };

    return {
        isEditOpen,
        isDeleteOpen,
        isLoading,
        userToEdit,
        openEditUser,
        closeEditUser,
        openDeleteUser,
        closeDeleteUser,
        openAddUser,
        isCreateOpen,
        closeCreateUser
    };
};