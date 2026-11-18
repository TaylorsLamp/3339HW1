<script setup>
import { reactive } from 'vue';
const props = defineProps({
  id: { type: String, required: true }, fields: { type: Array, required: true },
  submitLabel: { type: String, required: true }, disabled: Boolean
});
const emit = defineEmits(['submit']);
const values = reactive(Object.fromEntries(props.fields.map(field => [field.key, ''])));
function reset() { Object.keys(values).forEach(key => { values[key] = ''; }); }
function submit() { emit('submit', Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))); }
defineExpose({ reset });
</script>
<template>
  <form :id="id" @submit.prevent="submit">
    <fieldset :disabled="disabled">
      <legend class="sr-only">{{ submitLabel }}</legend>
      <div v-for="field in fields" :key="field.key" class="field">
        <label :for="`${id}-${field.key}`">{{ field.label }}</label>
        <input :id="`${id}-${field.key}`" v-model="values[field.key]" :name="field.key" :type="field.type || 'text'" :inputmode="field.inputmode || 'text'" :maxlength="field.max || 200" required>
      </div>
      <div class="actions"><button type="submit">{{ submitLabel }}</button><slot name="actions" /></div>
    </fieldset>
  </form>
</template>
