const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

function createApp(database, buildDirectory = path.resolve(__dirname, '../dist')) {
  const { connection, Student, Course, Enrollment } = database;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (req, res, next) => {
    if (connection.readyState !== 1) return res.status(503).json({ error: 'MongoDB is unavailable. Check the local service and try again.' });
    next();
  });
  function error(status, message) { return Object.assign(new Error(message), { status }); }
  function validate(body, rules) {
    return Object.fromEntries(Object.entries(rules).map(([key, max]) => {
      const value = body?.[key];
      if (typeof value !== 'string' || !value.trim()) throw error(400, `${key} is required.`);
      if (value.trim().length > max) throw error(400, `${key} must be ${max} characters or fewer.`);
      return [key, value.trim()];
    }));
  }
  async function getStudent(id) {
    const { studentId } = validate({ studentId: id }, { studentId: 50 });
    const student = await Student.findOne({ studentId: studentId.toUpperCase() });
    if (!student) throw error(404, 'Student not found.');
    return student;
  }
  async function getCourse(id) {
    const { courseId } = validate({ courseId: id }, { courseId: 50 });
    const course = await Course.findOne({ courseId: courseId.toUpperCase() });
    if (!course) throw error(404, 'Course not found.');
    return course;
  }
  const studentData = item => ({ studentId: item.studentId, name: item.name, phone: item.phone, zip: item.zip });
  const courseData = item => ({ courseId: item.courseId, name: item.name });

  // Serialize writes in this one-server local deployment. This prevents an enrollment
  // from passing its parent checks during a cascading deletion on standalone MongoDB.
  let queue = Promise.resolve();
  function write(method, url, handler) {
    app[method](url, (req, res, next) => {
      const operation = queue.then(() => handler(req, res));
      queue = operation.catch(() => {});
      operation.catch(next);
    });
  }
  app.get('/api/health', (req, res) => res.json({ status: 'ok', database: 'MongoDB' }));
  app.get('/api/students', async (req, res) => {
    if (Object.keys(req.query).some(key => key !== 'name')) throw error(400, 'Only the name search parameter is supported.');
    const filter = req.query.name === undefined ? {} : {
      searchName: validate(req.query, { name: 200 }).name.toLowerCase()
    };
    res.json((await Student.find(filter).sort({ name: 1, studentId: 1 }).lean()).map(studentData));
  });
  write('post', '/api/students', async (req, res) => {
    const data = validate(req.body, { studentId: 50, name: 200, phone: 40, zip: 20 });
    const saved = await Student.create({ ...data, searchName: data.name.toLowerCase() });
    res.status(201).json({ message: 'Student added.', student: studentData(saved) });
  });
  write('delete', '/api/students/:id', async (req, res) => {
    const student = await getStudent(req.params.id);
    await Enrollment.deleteMany({ student: student._id });
    await student.deleteOne();
    res.json({ message: 'Student and associated enrollments deleted.' });
  });
  app.get('/api/courses', async (req, res) => res.json((await Course.find().sort({ courseId: 1 }).lean()).map(courseData)));
  write('post', '/api/courses', async (req, res) => {
    const course = await Course.create(validate(req.body, { courseId: 50, name: 200 }));
    res.status(201).json({ message: 'Course added.', course: courseData(course) });
  });
  write('delete', '/api/courses/:id', async (req, res) => {
    const course = await getCourse(req.params.id);
    await Enrollment.deleteMany({ course: course._id });
    await course.deleteOne();
    res.json({ message: 'Course and associated enrollments deleted.' });
  });
  write('post', '/api/enrollments', async (req, res) => {
    const data = validate(req.body, { studentId: 50, courseId: 50 });
    const student = await getStudent(data.studentId);
    const course = await getCourse(data.courseId);
    await Enrollment.create({ student: student._id, course: course._id });
    res.status(201).json({ message: 'Student enrolled.' });
  });
  app.get('/api/courses/:id/students', async (req, res) => {
    const course = await getCourse(req.params.id);
    const enrollments = await Enrollment.find({ course: course._id }).lean();
    const students = await Student.find({ _id: { $in: enrollments.map(item => item.student) } }).sort({ name: 1 }).lean();
    res.json(students.map(studentData));
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  app.use(express.static(buildDirectory));
  app.get('/{*route}', (req, res) => {
    if (!fs.existsSync(path.join(buildDirectory, 'index.html'))) return res.status(503).send('Run npm run build before starting the application.');
    res.sendFile(path.join(buildDirectory, 'index.html'));
  });
  app.use((failure, req, res, next) => {
    if (failure.code === 11000) {
      const message = failure.keyPattern?.student ? 'Student is already enrolled in this course.' :
        req.path.includes('/courses') ? 'Course ID already exists.' : 'Student ID already exists.';
      return res.status(409).json({ error: message });
    }
    if (failure.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
    if (failure.name === 'ValidationError' || failure.name === 'CastError') return res.status(400).json({ error: 'Invalid record. Check all required fields and their lengths.' });
    if (failure.status) return res.status(failure.status).json({ error: failure.message });
    if (failure.name?.includes('Mongo') || failure.name === 'MongooseError') return res.status(503).json({ error: 'Database operation failed. Check that MongoDB is running and try again.' });
    console.error(failure);
    res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  });
  return app;
}
module.exports = { createApp };
