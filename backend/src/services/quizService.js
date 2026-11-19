const Question = require('../models/Question');
const Quiz = require('../models/Quiz');

async function refreshQuizTotals(quizId) {
  const questions = await Question.find({ quiz: quizId }).select('marks');
  await Quiz.updateOne({ _id: quizId }, { totalMarks: questions.reduce((s, q) => s + q.marks, 0), questionCount: questions.length });
}

/** Pure grading function: returns graded answers and totals. Unanswered questions score 0. */
function gradeAnswers(questions, answers, passingMarks) {
  const byQuestion = new Map(answers.map((a) => [String(a.questionId), a.selectedIndex]));
  let score = 0; let totalMarks = 0;
  const graded = questions.map((q) => {
    totalMarks += q.marks;
    const selected = byQuestion.get(String(q._id));
    const isCorrect = Number.isInteger(selected) && selected === q.correctIndex;
    const marksAwarded = isCorrect ? q.marks : 0;
    score += marksAwarded;
    return { question: q._id, selectedIndex: Number.isInteger(selected) ? selected : null, isCorrect, marksAwarded };
  });
  const percentage = totalMarks ? Math.round((score / totalMarks) * 1000) / 10 : 0;
  return { graded, score, totalMarks, percentage, passed: score >= passingMarks };
}

module.exports = { refreshQuizTotals, gradeAnswers };
