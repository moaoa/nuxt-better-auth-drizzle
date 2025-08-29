<script setup lang="ts">
import { ref } from 'vue';
import NotionConnectStep from './NotionConnectStep.vue';
import QuickbooksConnectStep from './QuickbooksConnectStep.vue';
import NotionDatabaseStep from './NotionDatabaseStep.vue';
import AutomationRecordStep from './AutomationRecordStep.vue';
import ConnectionRecordStep from './ConnectionRecordStep.vue';

const steps = [
  { name: 'Connect with Notion', component: NotionConnectStep },
  { name: 'Connect with QuickBooks', component: QuickbooksConnectStep },
  { name: 'Create or Select Notion Database', component: NotionDatabaseStep },
  { name: 'Create Automation Record', component: AutomationRecordStep },
  { name: 'Create Connection Record', component: ConnectionRecordStep },
];

const currentStepIndex = ref(0);

const currentStepComponent = computed(() => steps[currentStepIndex.value].component);

const nextStep = () => {
  if (currentStepIndex.value < steps.length - 1) {
    currentStepIndex.value++;
  }
};

const prevStep = () => {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--;
  }
};

const isLastStep = computed(() => currentStepIndex.value === steps.length - 1);
const isFirstStep = computed(() => currentStepIndex.value === 0);
</script>

<template>
  <div class="stepper-container">
    <div class="stepper-progress">
      <div
        v-for="(step, index) in steps"
        :key="index"
        :class="{
          'step-item': true,
          'active': index === currentStepIndex,
          'completed': index < currentStepIndex,
        }"
      >
        {{ step.name }}
      </div>
    </div>

    <div class="stepper-content">
      <component :is="currentStepComponent" @next="nextStep" @prev="prevStep" />
    </div>

    <div class="stepper-navigation">
      <Button @click="prevStep" :disabled="isFirstStep">Previous</Button>
      <Button @click="nextStep" :disabled="isLastStep">Next</Button>
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
