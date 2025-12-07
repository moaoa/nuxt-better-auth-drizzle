<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";

const props = defineProps({
  steps: {
    type: Array as () => Array<{ name: string }>, // Define type for steps prop
    required: true,
  },
  currentStepIndex: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(["next", "prev"]);

const isLastStep = computed(
  () => props.currentStepIndex === props.steps.length - 1
);
const isFirstStep = computed(() => props.currentStepIndex === 0);
</script>

<template>
  <div class="stepper-container">
    <div class="stepper-progress">
      <div
        v-for="(step, index) in steps"
        :key="index"
        :class="{
          'step-item': true,
          active: index === currentStepIndex,
          completed: index < currentStepIndex,
        }"
      >
        {{ step.name }}
      </div>
    </div>

    <div class="stepper-content">
      <slot :name="`step-${currentStepIndex}`"></slot>
    </div>

    <div class="stepper-navigation">
      <Button @click="$emit('prev')" :disabled="isFirstStep"> Previous </Button>
      <Button @click="$emit('next')" :disabled="isLastStep">Next</Button>
    </div>
  </div>
</template>

<style scoped>
.stepper-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.stepper-progress {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.step-item {
  padding: 10px 15px;
  border-radius: 5px;
  background-color: #f0f0f0;
  color: #555;
  font-weight: bold;
}

.step-item.active {
  background-color: #007bff;
  color: white;
}

.step-item.completed {
  background-color: #28a745;
  color: white;
}

.stepper-content {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #ccc;
  padding: 20px;
  border-radius: 5px;
}

.stepper-navigation {
  display: flex;
  justify-content: space-between;
}
</style>
