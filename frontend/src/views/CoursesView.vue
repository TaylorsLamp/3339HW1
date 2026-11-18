<script setup>
import { ref } from 'vue';
import { useSchool } from '../stores/school.js';
import { courseColumns } from '../columns.js';
import RecordForm from '../components/RecordForm.vue';
import RecordTable from '../components/RecordTable.vue';
import ConfirmDelete from '../components/ConfirmDelete.vue';
const school = useSchool();
const form = ref(null);
const deleting = ref(null);
async function add(data) {
  await school.run(async () => { await school.addCourse(data); form.value.reset(); });
}
async function remove() {
  await school.run(async () => { await school.removeCourse(deleting.value.courseId); deleting.value = null; });
}
</script>
<template>
  <div class="page-title"><p class="eyebrow">Course catalog</p><h1>Courses</h1><p>Create courses and manage the classes available for enrollment.</p></div>
  <section class="card narrow"><h2>Add a course</h2><p class="muted">Give each course a unique ID, such as CIS 3339.</p>
    <RecordForm id="add-course" ref="form" :fields="[{ key: 'courseId', label: 'Course ID', max: 50 }, { key: 'name', label: 'Course name' }]" submit-label="Add course" :disabled="school.loading" @submit="add" />
  </section>
  <section class="card"><div class="section-title"><h2>All courses</h2><span class="count">{{ school.counts.courses }}</span></div>
    <ConfirmDelete v-if="deleting" :name="`${deleting.name} (${deleting.courseId})`" :disabled="school.loading" @confirm="remove" @cancel="deleting = null" />
    <RecordTable :rows="school.courses" :columns="courseColumns" row-key="courseId" removable :disabled="school.loading" empty-text="No courses yet. Add your first course above." @remove="deleting = $event" />
  </section>
</template>
