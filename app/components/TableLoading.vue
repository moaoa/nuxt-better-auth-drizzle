<script lang="ts" setup>
/**
 *
 * Component Description:Desc
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
    <section>
        <div class="animate-pulse space-y-2">
            <!-- Table -->
            <div class="border border-gray-200 rounded-lg overflow-hidden">
                <!-- Table Header -->

                <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                <div class="grid grid-cols-6 gap-4 bg-gray-200 p-4">
                    <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                    <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                    <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                    <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                    <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                    <UiSkeleton class="h-5 w-full bg-gray-300 rounded"></UiSkeleton>
                </div>
                <!-- Table Rows -->
                <div class="divide-y divide-gray-200" v-for="i in 5" :key="i">
                    <div class="grid grid-cols-6 gap-4 p-4">
                        <UiSkeleton class="h-5 w-3/4 bg-gray-300 rounded"></UiSkeleton>
                        <UiSkeleton class="h-5 w-2/3 bg-gray-300 rounded"></UiSkeleton>
                        <UiSkeleton class="h-5 w-1/2 bg-gray-300 rounded"></UiSkeleton>
                        <UiSkeleton class="h-5 w-1/3 bg-gray-300 rounded"></UiSkeleton>
                        <UiSkeleton class="h-5 w-1/4 bg-gray-300 rounded"></UiSkeleton>
                        <UiSkeleton class="h-5 w-1/6 bg-gray-300 rounded"></UiSkeleton>
                    </div>
                </div>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between mt-4">
                <div class="h-6 w-32 bg-gray-300 rounded"></div>
                <div class="flex gap-2">
                    <div class="h-8 w-8 bg-gray-300 rounded"></div>
                    <div class="h-8 w-8 bg-gray-300 rounded"></div>
                    <div class="h-8 w-8 bg-gray-300 rounded"></div>
                </div>
            </div>
        </div>

    </section>
</template>
<style scoped></style>