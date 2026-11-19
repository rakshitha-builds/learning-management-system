const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    options: {
      type: [{ text: { type: String, required: true, trim: true, maxlength: 400 } }],
      validate: [(v) => v.length >= 2 && v.length <= 6, 'A question needs 2 to 6 options'],
    },
    correctIndex: { type: Number, required: true, min: 0 }, // NEVER returned to students before submission
    marks: { type: Number, default: 1, min: 1 },
    explanation: { type: String, trim: true, maxlength: 1000 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
questionSchema.path('correctIndex').validate(function (v) { return v < this.options.length; }, 'correctIndex must point to an option');

module.exports = mongoose.model('Question', questionSchema);
