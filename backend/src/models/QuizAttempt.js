const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    answers: [{ _id: false, question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' }, selectedIndex: Number, isCorrect: Boolean, marksAwarded: Number }],
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    timedOut: { type: Boolean, default: false },
    timeTakenSec: Number,
  },
  { timestamps: true }
);
quizAttemptSchema.index({ quiz: 1, student: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
