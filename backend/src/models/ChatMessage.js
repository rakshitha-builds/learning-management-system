const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    liveClass: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveClass', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);
chatMessageSchema.index({ liveClass: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
