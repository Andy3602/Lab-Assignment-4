const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 10000 },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "category", default: null },
  isFavorite: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

const noteModel = mongoose.model("note", noteSchema);

module.exports = { noteModel };
