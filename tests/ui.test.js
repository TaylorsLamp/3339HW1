import { beforeAll, afterAll, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import App from '../frontend/src/App.vue';
import { makeRouter } from '../frontend/src/router.js';
import { useSchool } from '../frontend/src/stores/school.js';
const require=createRequire(import.meta.url);
const {openDatabase}=require('../backend/database.cjs');
const {createApp}=require('../backend/app.cjs');
const savedFetch=globalThis.fetch;
const databaseName=`cis3339_ui_test_${process.pid}_${Date.now()}`;
let database,server,wrapper,school,router;
async function settle() { await flushPromises(); await vi.waitFor(()=>expect(school.loading).toBe(false),{timeout:5000}); await flushPromises(); }
async function fill(id,value) { await wrapper.get('#'+id).setValue(value); }
async function submit(id) { await wrapper.get('#'+id).trigger('submit'); await settle(); }
async function go(url) { await router.push(url); await settle(); }
beforeAll(async()=>{
  const dotenv=require('dotenv');
  dotenv.config({path:require.resolve('../.env'),quiet:true});
  const uri=new URL(process.env.MONGODB_URI); uri.pathname='/'+databaseName;
  database=await openDatabase(uri.toString());
  server=createApp(database).listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  globalThis.fetch=(url,options)=>savedFetch(new URL(url,base),options);
  router=makeRouter(createMemoryHistory()); const pinia=createPinia(); school=useSchool(pinia);
  await router.push('/students'); await router.isReady();
  wrapper=mount(App,{global:{plugins:[pinia,router]},attachTo:document.body}); await settle();
});
afterAll(async()=>{
  wrapper?.unmount(); globalThis.fetch=savedFetch;
  if(server?.listening) await new Promise(resolve=>server.close(resolve));
  if(database){expect(database.connection.name).toBe(databaseName);await database.connection.dropDatabase();await database.connection.close();}
});
test('empty interface renders navigation, labels and feedback region',()=>{
  expect(wrapper.text()).toContain('No students yet.');
  expect(wrapper.find('nav[aria-label="Main navigation"]').exists()).toBe(true);
  for(const input of wrapper.findAll('input')) expect(wrapper.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true);
  expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true);
});
test('student forms save through HTTP and safely render user content',async()=>{
  await fill('add-student-name','John');await fill('add-student-studentId','1001');await fill('add-student-phone','555-1234');await fill('add-student-zip','77001');
  await submit('add-student');expect(wrapper.text()).toContain('Student added.');expect(wrapper.get('#add-student-name').element.value).toBe('');
  await fill('add-student-name','Jane <script>alert(1)</script>');await fill('add-student-studentId','1002');await fill('add-student-phone','555-5678');await fill('add-student-zip','01234');
  await submit('add-student');expect(wrapper.get('tbody').text()).toContain('Jane <script>alert(1)</script>');expect(wrapper.find('tbody script').exists()).toBe(false);expect(wrapper.text()).toContain('01234');
});
test('student search, no results, duplicates and whitespace validation',async()=>{
  await fill('search-student-name','john');await submit('search-student');expect(wrapper.get('tbody').text()).toContain('John');expect(wrapper.get('tbody').text()).not.toContain('Jane');
  await fill('search-student-name','missing');await submit('search-student');expect(wrapper.get('tbody').text()).toContain('No matching students.');
  await fill('add-student-name','Duplicate');await fill('add-student-studentId','1001');await fill('add-student-phone','555');await fill('add-student-zip','77001');await submit('add-student');
  expect(wrapper.get('[role="alert"]').text()).toContain('Student ID already exists');expect(wrapper.get('#add-student-name').element.value).toBe('Duplicate');
  await fill('add-student-name','   ');await submit('add-student');expect(wrapper.get('[role="alert"]').text()).toContain('name is required');
});
test('Vue Router navigation and course form update shared Pinia state',async()=>{
  await wrapper.get('nav a[href="/courses"]').trigger('click');await settle();expect(router.currentRoute.value.path).toBe('/courses');
  await fill('add-course-courseId','CIS 3339');await fill('add-course-name','Enterprise Applications Development');await submit('add-course');
  expect(wrapper.text()).toContain('Course added.');expect(wrapper.get('tbody').text()).toContain('CIS 3339');
  await fill('add-course-courseId','CIS 3368');await fill('add-course-name','Advanced Object-Oriented Programming');await submit('add-course');expect(school.counts.courses).toBe(2);
  await fill('add-course-courseId','cis 3339');await fill('add-course-name','Duplicate');await submit('add-course');expect(wrapper.get('[role="alert"]').text()).toContain('Course ID already exists');
});
test('server-backed enrollment dropdowns, duplicates and rosters work',async()=>{
  await go('/enrollments');expect(wrapper.get('#enroll-student').findAll('option')).toHaveLength(3);expect(wrapper.get('#enroll-course').findAll('option')).toHaveLength(3);
  await fill('enroll-student','1001');await fill('enroll-course','CIS 3339');await submit('enroll');expect(wrapper.text()).toContain('Student enrolled.');expect(wrapper.get('tbody').text()).toContain('John');
  await submit('enroll');expect(wrapper.get('[role="alert"]').text()).toContain('already enrolled');
  await fill('enroll-student','1002');await submit('enroll');expect(wrapper.get('tbody').findAll('tr')).toHaveLength(2);
  await fill('roster-course','CIS 3368');await submit('roster');expect(wrapper.get('tbody').text()).toContain('No students enrolled');
  await fill('roster-course','CIS 3339');await submit('roster');expect(wrapper.get('tbody').findAll('tr')).toHaveLength(2);
});
test('student deletion supports cancel and updates shared enrollment state',async()=>{
  await go('/students');await wrapper.get('[aria-label="Delete John (1001)"]').trigger('click');await wrapper.get('.confirmation .secondary').trigger('click');expect(school.counts.students).toBe(2);
  await wrapper.get('[aria-label="Delete John (1001)"]').trigger('click');await wrapper.get('.confirmation .danger').trigger('click');await settle();expect(school.counts.students).toBe(1);
  await go('/enrollments');expect(wrapper.get('tbody').text()).not.toContain('John');expect(wrapper.get('tbody').text()).toContain('Jane');expect(wrapper.get('#enroll-student').findAll('option')).toHaveLength(2);
});
test('course deletion clears its roster and removes it from choices',async()=>{
  await go('/courses');await wrapper.get('[aria-label="Delete Enterprise Applications Development (CIS 3339)"]').trigger('click');await wrapper.get('.confirmation .danger').trigger('click');await settle();expect(school.counts.courses).toBe(1);
  await go('/enrollments');expect(school.roster).toEqual([]);expect(wrapper.get('#enroll-course').text()).not.toContain('CIS 3339');expect(wrapper.text()).toContain('Select a course above');expect(await database.Enrollment.countDocuments()).toBe(0);
});
test('loading and network error states recover',async()=>{
  let release;const pending=school.run(()=>new Promise(resolve=>{release=resolve;}));await flushPromises();expect(wrapper.get('[role="status"]').text()).toBe('Working…');expect(wrapper.get('main').attributes('aria-busy')).toBe('true');release();await pending;await settle();
  const workingFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('offline');};await school.run(school.refresh);await settle();expect(wrapper.get('[role="alert"]').text()).toContain('Cannot reach the server');
  globalThis.fetch=workingFetch;await school.run(school.refresh);await settle();expect(wrapper.find('[role="alert"]').exists()).toBe(false);
});
