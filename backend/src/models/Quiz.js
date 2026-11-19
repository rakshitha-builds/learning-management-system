const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 1000 },
    durationMinutes: { type: Number, required: true, min: 1, max: 300 },
    passingMarks: { type: Number, required: true, min: 0 },
    totalMarks: { type: Number, default: 0 }, // cached sum of question marks
    questionCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
