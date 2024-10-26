<script lang="ts" setup>
/**
 *
 * Layout for user that are authentificated only
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
</script>

<template>
    <section class=" flex flex-col dark:bg-neutral-950 dark:text-slate-400 min-h-svh">
        <header>
            <div class="logo">Only for authentificated users</div>
            <nav class="navigation">
                <ul>
                    <li>10</li>
                    <li>10</li>
                    <li>10</li>
                </ul>
            </nav>
        </header>
        <slot />
    </section>
</template>
<style scoped></style>