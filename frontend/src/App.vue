<script setup>
import { onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSchool } from './stores/school.js';
import Feedback from './components/Feedback.vue';
const school = useSchool();
const route = useRoute();
onMounted(() => school.run(school.refresh));
watch(() => route.path, () => school.message(''));
</script>
<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <header><div class="header-content">
    <RouterLink to="/students" class="brand"><span class="monogram" aria-hidden="true">SM</span><span>Student Management<small>CIS 3339 · Homework 1</small></span></RouterLink>
    <nav aria-label="Main navigation"><RouterLink to="/students">Students</RouterLink><RouterLink to="/courses">Courses</RouterLink><RouterLink to="/enrollments">Enrollments</RouterLink></nav>
  </div></header>
  <main id="main" :aria-busy="school.loading">
    <div class="summary"><span>{{ school.counts.students }} students</span><span>{{ school.counts.courses }} courses</span><button class="link-button" :disabled="school.loading" @click="school.run(school.refresh)">Refresh data</button></div>
    <Feedback :message="school.notice" :error="school.error" :loading="school.loading" />
    <RouterView />
  </main>
  <footer>Student records, course catalog, and enrollment</footer>
</template>
