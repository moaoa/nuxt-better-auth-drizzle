import { authClient } from '~~/lib/auth-client';

import { ref } from 'vue'
import { useToast } from '~/components/ui/toast';
import type { User } from '~~/db/schema';
type UserCreate = Pick<User, 'name' | 'email' | 'image' | 'emailVerified' | 'banned'> & { password: string, role: string, firstName: string, lastName: string }

type Error = {
    message: string
}
const { toast } = useToast()
const users = ref<User[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
export const useUserManagement = () => {

    const fetchUsers = async () => {
        try {
            isLoading.value = true
            const fetchedUsers = await authClient.admin.listUsers({
                query: {
                    limit: 10,
                }
            });
            users.value = fetchedUsers.data?.users as unknown as User[] || [];

        } catch (err) {
            toast({
                title: "Error",
                description: (err as Error).message || "Failed to fetch users",
                variant: "destructive",
            });

        } finally {
            isLoading.value = false
        }
    }

    const createUserAsAdmin = async (user: UserCreate) => {
        try {
            isLoading.value = true;
            await authClient.admin.createUser({
                name: user.name,
                email: user.email,
                password: user.password,
                role: user.role,
                data: {
                    // any additional on the user table including plugin fields and custom fields
                    firstName: user.firstName,
                    lastName: user.lastName,
                    emailVerified: user.emailVerified,
                    banned: user.banned,
                    image: user.image,
                }
            });
            toast({
                title: "Success",
                description: "User created successfully",
            })

        } catch (err) {
            toast({
                title: "Error",
                description: (err as Error).message || "Failed to create user",
                variant: "destructive",
            });
        } finally {
            isLoading.value = false
        }
    }

    const deleteUser = async (userId: string) => {
        try {
            isLoading.value = true;
            await authClient.admin.removeUser({
                userId
            });
            toast({
                title: "Success",
                description: "User deleted successfully",
            });

        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete user",
                variant: "destructive",
            });
        } finally {
            isLoading.value = false;
        }
    }

    const updateUserRole = async (userId: string, role: string) => {
        try {
            isLoading.value = true;
            await authClient.admin.setRole({
                userId,
                role
            });

            toast({
                title: "Success",
                description: "Updated user role successfully",
            });

        } catch (err) {
            toast({
                title: "Error",
                description: (err as Error).message || "Failed to update user role",
                variant: "destructive",
            });
        } finally {
            isLoading.value = false;
        }
    }

    const impersonateUser = async (userId: string) => {
        try {
            isLoading.value = true;
            await authClient.admin.impersonateUser({
                userId
            });
        } catch (err) {
            toast({
                title: "Error",
                description: (err as Error).message || "Failed to impersonate user",
                variant: "destructive",
            });
        } finally {
            isLoading.value = false;
        }
    }

    const updateUserBan = async (userId: string, banUser: boolean) => {
        try {
            isLoading.value = true;
            if (banUser) {
                await authClient.admin.banUser({
                    userId
                });
            } else {
                await authClient.admin.unbanUser({
                    userId
                });
            }

            toast({
                title: "Success",
                description: `Updated user ban status successfully`,
            });

        } catch (err) {
            toast({
                title: "Error",
                description: (err as Error).message || "Failed to ban user",
                variant: "destructive",
            });
        } finally {
            isLoading.value = false;
        }
    }


    return {
        users,
        isLoading,
        error,
        fetchUsers,
        deleteUser,
        updateUserRole,
        updateUserBan,
        createUserAsAdmin,
        impersonateUser
    }
}