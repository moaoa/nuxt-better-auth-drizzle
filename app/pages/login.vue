<script lang="ts" setup>
import { signIn } from '~~/lib/auth-client';
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
    email: '',
    password: '',
});
 
const loginFormSchema = [
    {
        $el: 'h1',
        children: 'Login',
        attrs: {
            class: 'text-2xl font-bold mb-4',
        },
    },
    {
        $formkit: 'text',
        name: 'email',
        label: 'Email',
        help: 'This will be used for your account.',
        validation: 'required|email',
    },
    {
        $formkit: 'password',
        name: 'password',
        label: 'Password',
        help: 'Enter your new password.',
        validation: 'required|length:5,16',
    }
]


const HandleLoginUser = async () => {
    await signIn.email({
        email: loginForm.value.email,
        password: loginForm.value.password,
        callbackURL: '/app/',
        fetchOptions: {
            onError: (err) => console.log(err)
        }
    })
}
</script>

<template>
    <div class='grid place-content-center min-h-screen'>
        <section class='max-w-2xl'>
            <FormKit
id="login-form" v-slot="{ state: { valid } }" v-model="loginForm" type="form"
                :actions="false" @submit="HandleLoginUser">
                <FormKitSchema :schema="loginFormSchema" />
                <FormKit type="submit" label="Login" :disabled="!valid" />
            </FormKit>
        </section>
    </div>
</template>
<style scoped></style>