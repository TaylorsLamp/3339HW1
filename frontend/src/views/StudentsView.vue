<script setup>
import { computed, ref } from 'vue';
import { useSchool } from '../stores/school.js';
import { studentColumns } from '../columns.js';
import RecordForm from '../components/RecordForm.vue';
import RecordTable from '../components/RecordTable.vue';
import ConfirmDelete from '../components/ConfirmDelete.vue';
const school = useSchool();
const form = ref(null);
const matches = ref(null);
const deleting = ref(null);
const rows = computed(() => matches.value === null ? school.students : matches.value.filter(match => school.students.some(student => student.studentId === match.studentId)));
const fields = [{ key: 'name', label: 'Name' }, { key: 'studentId', label: 'Student ID', max: 50 },
  { key: 'phone', label: 'Phone number', type: 'tel', max: 40 }, { key: 'zip', label: 'ZIP code', inputmode: 'numeric', max: 20 }];
async function add(data) {
  await school.run(async () => {
    await school.addStudent(data); form.value.reset(); matches.value = null;
  });
}
async function search(data) {
  await school.run(async () => {
    matches.value = [];
    matches.value = await school.search(data.name);
    school.message(`${matches.value.length} student(s) found.`);
  });
}
async function remove() {
  await school.run(async () => {
    await school.removeStudent(deleting.value.studentId); deleting.value = null;
  });
}
</script>
<template>
  <div class="page-title"><p class="eyebrow">Student records</p><h1>Students</h1><p>Add a student, find a record, and manage your student list.</p></div>
  <div class="two-columns">
    <section class="card"><h2>Add a student</h2><p class="muted">All fields are required. Student IDs must be unique.</p>
      <RecordForm id="add-student" ref="form" :fields="fields" submit-label="Add student" :disabled="school.loading" @submit="add" />
    </section>
    <section class="card"><h2>Find a student</h2><p class="muted">Search by full name. Capitalization does not matter.</p>
      <RecordForm id="search-student" :fields="[{ key: 'name', label: 'Student name' }]" submit-label="Search" :disabled="school.loading" @submit="search">
        <template #actions><button type="button" class="secondary" @click="matches = null; school.message('Showing all students.')">Show all students</button></template>
      </RecordForm>
    </section>
  </div>
  <section class="card"><div class="section-title"><h2>{{ matches === null ? 'All students' : 'Search results' }}</h2><span class="count">{{ rows.length }}</span></div>
    <ConfirmDelete v-if="deleting" :name="`${deleting.name} (${deleting.studentId})`" :disabled="school.loading" @confirm="remove" @cancel="deleting = null" />
    <RecordTable :rows="rows" :columns="studentColumns" row-key="studentId" removable :disabled="school.loading" :empty-text="matches === null ? 'No students yet. Add your first student above.' : 'No matching students. Try another name.'" @remove="deleting = $event" />
  </section>
</template>
