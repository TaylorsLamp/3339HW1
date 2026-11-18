import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { api } from '../api.js';

export const useSchool = defineStore('school', () => {
  const students = ref([]);
  const courses = ref([]);
  const roster = ref([]);
  const rosterId = ref('');
  const notice = ref('');
  const error = ref(false);
  const pending = ref(0);
  const loading = computed(() => pending.value > 0);
  const counts = computed(() => ({ students: students.value.length, courses: courses.value.length }));
  const rosterCourse = computed(() => courses.value.find(course => course.courseId === rosterId.value));

  function message(text, isError = false) { notice.value = text; error.value = isError; }
  async function run(action) {
    pending.value++;
    message('');
    try { return await action(); }
    catch (failure) { message(failure.message, true); return undefined; }
    finally { pending.value--; }
  }
  async function refresh() {
    const [savedStudents, savedCourses] = await Promise.all([api('/students'), api('/courses')]);
    students.value = savedStudents;
    courses.value = savedCourses;
    if (rosterId.value) {
      if (courses.value.some(course => course.courseId === rosterId.value)) {
        roster.value = await api(`/courses/${encodeURIComponent(rosterId.value)}/students`);
      } else { rosterId.value = ''; roster.value = []; }
    }
    return true;
  }
  async function addStudent(data) {
    const result = await api('/students', 'POST', data);
    await refresh(); message(result.message);
    return result.student;
  }
  async function search(name) { return api(`/students?name=${encodeURIComponent(name.trim())}`); }
  async function removeStudent(id) {
    const result = await api(`/students/${encodeURIComponent(id)}`, 'DELETE');
    await refresh(); message(result.message); return true;
  }
  async function addCourse(data) {
    const result = await api('/courses', 'POST', data);
    await refresh(); message(result.message); return result.course;
  }
  async function removeCourse(id) {
    const result = await api(`/courses/${encodeURIComponent(id)}`, 'DELETE');
    await refresh(); message(result.message); return true;
  }
  async function loadRoster(id) {
    const students = await api(`/courses/${encodeURIComponent(id)}/students`);
    rosterId.value = id; roster.value = students;
    return students;
  }
  async function enroll(data) {
    const result = await api('/enrollments', 'POST', data);
    await loadRoster(data.courseId); message(result.message); return true;
  }
  return { students, courses, roster, rosterId, rosterCourse, notice, error, loading, counts,
    message, run, refresh, addStudent, search, removeStudent, addCourse, removeCourse, loadRoster, enroll };
});
