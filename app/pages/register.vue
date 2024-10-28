<script lang="ts" setup>
import { signUp } from '~~/lib/auth-client';
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
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    password_confirm: '',
});

const registerForm = computed(() => ([
    {
        $el: 'h1',
        children: 'Register',
        attrs: {
            class: 'text-2xl font-bold mb-4',
        },
    },
    {
        $cmp: 'FormKit',
        props: {
            type: 'text',
            name: 'firstName',
            label: 'First name',
            validation: 'required',
        }
    },
    {
        $formkit: 'text',
        name: 'lastName',
        label: 'Last name',
        validation: 'required|length:3,30',
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
    },
    {
        $formkit: 'password',
        name: 'password_confirm',
        label: 'Confirm password',
        help: 'Enter your new password again to confirm it.',
        validation: 'required|confirm',
        validationLabel: 'password confirmation',
    }
]));


const HandleRegisterUser = async () => {

    await signUp.email({
        email: userInformation.value.email,
        password: userInformation.value.password,
        name: `${userInformation.value.firstName} ${userInformation.value.lastName}`.toUpperCase().replaceAll(' ', '-'),        
        firstName: userInformation.value.firstName,
        lastName: userInformation.value.lastName,
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
            <FormKit id="register-form" type="form" :actions="false" @submit="HandleRegisterUser"
                v-slot="{ state: { valid } }" v-model="userInformation">
                <FormKitSchema :schema="registerForm" />
                <FormKit type="submit" label="Register" :disabled="!valid" />
            </FormKit>
        </section>
    </div>
</template>
<style scoped></style>