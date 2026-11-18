<script setup>
defineProps({ name: { type: String, required: true }, disabled: Boolean });
defineEmits(['confirm', 'cancel']);
</script>
<template>
  <div class="confirmation" role="group" aria-label="Confirm deletion">
    <p>Delete <strong>{{ name }}</strong>? All associated enrollments will also be removed.</p>
    <div class="actions"><button class="danger" :disabled="disabled" @click="$emit('confirm')">Confirm delete</button><button class="secondary" :disabled="disabled" @click="$emit('cancel')">Cancel</button></div>
  </div>
</template>
