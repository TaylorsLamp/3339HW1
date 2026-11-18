const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs/promises');
const { openDatabase } = require('../backend/database.cjs');
const { createApp } = require('../backend/app.cjs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

test('assignment workflow against real local MongoDB', async t => {
  const databaseName = `cis3339_test_${process.pid}_${Date.now()}`;
  const uri = new URL(process.env.MONGODB_URI);
  uri.pathname = `/${databaseName}`;
  let database, server, base;
  async function start() {
    database = await openDatabase(uri.toString());
    server = createApp(database).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function close() {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await database.connection.close();
  }
  t.after(async () => {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (database?.connection.readyState === 1) {
      assert.equal(database.connection.name, databaseName);
      await database.connection.dropDatabase();
      await database.connection.close();
    }
  });
  await start();
  async function request(url, method = 'GET', body, status = 200) {
    const response = await fetch(base + '/api' + url, { method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  }
  const john = { name: 'John', studentId: '1001', phone: '555-1234', zip: '77001' };
  const jane = { name: 'Jane', studentId: '1002', phone: '555-5678', zip: '77002' };
  const course = { courseId: 'CIS 3339', name: 'Enterprise Applications Development' };
  const course2 = { courseId: 'CIS 3368', name: 'Advanced Object-Oriented Programming' };
  const courseUrl = `/courses/${encodeURIComponent(course.courseId)}`;

  await t.test('empty database initializes without configuration or seed commands', async () => {
    assert.deepEqual(await request('/students'), []);
    assert.deepEqual(await request('/courses'), []);
    assert.equal((await request('/health')).database, 'MongoDB');
    const collections = await database.connection.db.listCollections().toArray();
    for (const name of ['students','courses','enrollments']) assert.ok(collections.some(item => item.name === name));
    assert.ok((await database.Student.collection.indexes()).some(item => item.unique && item.key.studentId));
    assert.ok((await database.Course.collection.indexes()).some(item => item.unique && item.key.courseId));
    assert.ok((await database.Enrollment.collection.indexes()).some(item => item.unique && item.key.student && item.key.course));
  });
  await t.test('production routes refresh successfully and built assets load', async () => {
    for (const route of ['/', '/students', '/courses', '/enrollments']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /id="app"/);
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)];
      assert.ok(assets.length >= 2);
      for (const asset of assets) assert.equal((await fetch(base + asset[1])).status, 200);
    }
    await request('/missing', 'GET', undefined, 404);
  });
  await t.test('student add, search, list and server validation', async () => {
    await request('/students','POST',{},400);
    await request('/students','POST',{ ...john, name: '  ' },400);
    await request('/students','POST',{ ...john, studentId: { $ne: '' } },400);
    await request('/students','POST',{ ...john, phone: 'x'.repeat(41) },400);
    assert.deepEqual((await request('/students','POST',{ ...john, name: ' John ' },201)).student,john);
    await request('/students','POST',jane,201);
    await request('/students','POST',john,409);
    assert.deepEqual(await request('/students?name=jOhN'),[john]);
    assert.deepEqual(await request('/students?name=missing'),[]);
    assert.equal((await request('/students')).length,2);
    await request('/students?name=', 'GET', undefined,400);
    await request('/students?name[$ne]=', 'GET', undefined,400);
    assert.equal((await database.Student.findOne({ studentId: john.studentId })).name,'John');
  });
  await t.test('course add, list, validation and duplicate rejection', async () => {
    await request('/courses','POST',{ courseId: course.courseId },400);
    await request('/courses','POST',course,201);
    await request('/courses','POST',course2,201);
    await request('/courses','POST',{ ...course, courseId: 'cis 3339' },409);
    assert.deepEqual(await request('/courses'),[course,course2]);
  });
  await t.test('enrollment references, duplicate prevention and populated roster', async () => {
    await request('/enrollments','POST',{},400);
    await request('/enrollments','POST',{ studentId: 'missing', courseId: course.courseId },404);
    await request('/enrollments','POST',{ studentId: john.studentId, courseId: 'missing' },404);
    assert.deepEqual(await request(`${courseUrl}/students`),[]);
    await request('/enrollments','POST',{ studentId: john.studentId, courseId: course.courseId },201);
    await request('/enrollments','POST',{ studentId: jane.studentId, courseId: course.courseId },201);
    await request('/enrollments','POST',{ studentId: john.studentId, courseId: course.courseId },409);
    assert.deepEqual(await request(`${courseUrl}/students`),[jane,john]);
  });
  await t.test('records persist after closing and restarting server and database connection', async () => {
    await close(); await start();
    assert.equal((await request('/students')).length,2);
    assert.equal((await request('/courses')).length,2);
    assert.deepEqual(await request(`${courseUrl}/students`),[jane,john]);
  });
  await t.test('student deletion cascades and a reused ID does not inherit enrollments', async () => {
    await request('/students/1001','DELETE');
    assert.deepEqual(await request('/students?name=John'),[]);
    assert.deepEqual(await request(`${courseUrl}/students`),[jane]);
    await request('/students/1001','DELETE',undefined,404);
    await request('/students','POST',john,201);
    assert.deepEqual(await request(`${courseUrl}/students`),[jane]);
  });
  await t.test('course deletion cascades and a reused ID has an empty roster', async () => {
    await request(courseUrl,'DELETE');
    assert.deepEqual(await request('/courses'),[course2]);
    assert.equal(await database.Enrollment.countDocuments(),0);
    await request(courseUrl,'DELETE',undefined,404);
    await request(`${courseUrl}/students`,'GET',undefined,404);
    await request('/courses','POST',course,201);
    assert.deepEqual(await request(`${courseUrl}/students`),[]);
  });
  await t.test('simultaneous duplicate requests result in exactly one enrollment', async () => {
    const responses = await Promise.all(Array.from({length:4},() => fetch(base+'/api/enrollments', {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:jane.studentId,courseId:course.courseId})
    })));
    assert.deepEqual(responses.map(item=>item.status).sort(),[201,409,409,409]);
    assert.equal(await database.Enrollment.countDocuments(),1);
  });
  await t.test('concurrent enrollment and deletion leave no orphan enrollments', async () => {
    await Promise.all([
      fetch(base+'/api/enrollments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:john.studentId,courseId:course2.courseId})}),
      request('/students/1001','DELETE')
    ]);
    for (const enrollment of await database.Enrollment.find()) {
      assert.ok(await database.Student.exists({_id:enrollment.student}));
      assert.ok(await database.Course.exists({_id:enrollment.course}));
    }
  });
  await t.test('bad JSON and a disconnected database have clear errors', async () => {
    const response=await fetch(base+'/api/students',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});
    assert.equal(response.status,400); assert.match((await response.json()).error,/JSON/);
    await database.connection.close();
    await request('/students','GET',undefined,503);
    await new Promise(resolve=>server.close(resolve)); await start();
  });
  await t.test('real local .env is included and local JSON storage is absent', async () => {
    const env=await fs.readFile(path.resolve(__dirname,'../.env'),'utf8');
    assert.match(env,/MONGODB_URI=mongodb:\/\/127\.0\.0\.1:27017\/cis3339_homework1/);
    await assert.rejects(fs.access(path.resolve(__dirname,'../students.json')));
  });
});
