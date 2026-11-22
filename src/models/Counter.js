const mongoose = require('mongoose');

// STU-0001 jaise codes ke liye atomic counter (ek waqt mein kai students add hon to bhi duplicate nahi banta)
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });

counterSchema.statics.next = async function (name) {
  const doc = await this.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
