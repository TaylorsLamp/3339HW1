<script setup>
defineProps({ message: { type: String, default: '' }, error: Boolean, loading: Boolean });
</script>
<template>
  <div class="feedback" aria-live="polite" aria-atomic="true">
    <p v-if="loading" role="status" class="notice">Working…</p>
    <p v-else-if="message" :role="error ? 'alert' : 'status'" class="notice" :class="{ error }">{{ message }}</p>
  </div>
</template>
