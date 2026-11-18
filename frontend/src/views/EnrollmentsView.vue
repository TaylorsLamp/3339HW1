<script setup>
import { ref, computed, watch } from 'vue';
import { useSchool } from '../stores/school.js';
import { studentColumns } from '../columns.js';
import RecordTable from '../components/RecordTable.vue';
const school = useSchool();
const studentId = ref('');
const courseId = ref('');
const rosterId = ref(school.rosterId);
const canEnroll = computed(() => school.students.length > 0 && school.courses.length > 0);
watch(() => school.students, students => { if (!students.some(student => student.studentId === studentId.value)) studentId.value = ''; });
watch(() => school.courses, courses => {
  if (!courses.some(course => course.courseId === courseId.value)) courseId.value = '';
  if (!courses.some(course => course.courseId === rosterId.value)) rosterId.value = '';
});
async function enroll() {
  await school.run(async () => { await school.enroll({ studentId: studentId.value, courseId: courseId.value }); rosterId.value = courseId.value; });
}
async function roster() {
  await school.run(async () => {
    await school.loadRoster(rosterId.value); school.message(`${school.roster.length} student(s) enrolled.`);
  });
}
</script>
<template>
  <div class="page-title"><p class="eyebrow">Class enrollment</p><h1>Enrollments</h1><p>Connect students with courses and view the class roster.</p></div>
  <div class="two-columns">
    <section class="card"><h2>Enroll a student</h2><p class="muted">Select an existing student and an existing course.</p>
      <p v-if="!canEnroll" class="empty">Add at least one <RouterLink to="/students">student</RouterLink> and one <RouterLink to="/courses">course</RouterLink> to begin.</p>
      <form id="enroll" @submit.prevent="enroll"><fieldset :disabled="school.loading || !canEnroll"><legend class="sr-only">Enroll a student</legend>
        <div class="field"><label for="enroll-student">Student</label><select id="enroll-student" v-model="studentId" required><option disabled value="">Select a student</option><option v-for="student in school.students" :key="student.studentId" :value="student.studentId">{{ student.name }} ({{ student.studentId }})</option></select></div>
        <div class="field"><label for="enroll-course">Course</label><select id="enroll-course" v-model="courseId" required><option disabled value="">Select a course</option><option v-for="course in school.courses" :key="course.courseId" :value="course.courseId">{{ course.name }} ({{ course.courseId }})</option></select></div>
        <button type="submit">Enroll student</button>
      </fieldset></form>
    </section>
    <section class="card"><h2>Find a course roster</h2><p class="muted">See the students enrolled in a saved course.</p>
      <form id="roster" @submit.prevent="roster"><fieldset :disabled="school.loading || !school.courses.length"><legend class="sr-only">Course roster</legend>
        <div class="field"><label for="roster-course">Course</label><select id="roster-course" v-model="rosterId" required><option disabled value="">Select a course</option><option v-for="course in school.courses" :key="course.courseId" :value="course.courseId">{{ course.name }} ({{ course.courseId }})</option></select></div>
        <button type="submit">List students</button>
      </fieldset></form>
    </section>
  </div>
  <section class="card"><div class="section-title"><h2>{{ school.rosterCourse ? `${school.rosterCourse.name} (${school.rosterId})` : 'Students in course' }}</h2><span v-if="school.rosterCourse" class="count">{{ school.roster.length }}</span></div>
    <RecordTable :rows="school.roster" :columns="studentColumns" row-key="studentId" :empty-text="school.rosterCourse ? 'No students enrolled in this course yet.' : 'Select a course above to view its roster.'" />
  </section>
</template>
