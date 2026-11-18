const mongoose = require('mongoose');

async function openDatabase(uri) {
  if (!uri) throw new Error('Set MONGODB_URI in the project .env file.');
  const connection = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000, bufferCommands: false, autoIndex: true
  }).asPromise();
  const string = max => ({ type: String, trim: true, required: true, maxlength: max });
  const settings = { versionKey: false, id: false };
  const studentSchema = new mongoose.Schema({
    studentId: { ...string(50), uppercase: true, unique: true },
    name: string(200),
    searchName: { ...string(200), lowercase: true, index: true },
    phone: string(40), zip: string(20)
  }, settings);
  const courseSchema = new mongoose.Schema({
    courseId: { ...string(50), uppercase: true, unique: true }, name: string(200)
  }, settings);
  const enrollmentSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true }
  }, settings);
  enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
  const Student = connection.model('Student', studentSchema);
  const Course = connection.model('Course', courseSchema);
  const Enrollment = connection.model('Enrollment', enrollmentSchema);
  try {
    // This creates collections and indexes for an empty database without a setup command.
    await Promise.all([Student.init(), Course.init(), Enrollment.init()]);
  } catch (error) {
    await connection.close();
    throw error;
  }
  return { connection, Student, Course, Enrollment };
}
module.exports = { openDatabase };
