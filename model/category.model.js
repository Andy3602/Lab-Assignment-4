const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameKey: { type: String, required: true },
}, { timestamps: true });

categorySchema.index({ userId: 1, nameKey: 1 }, { unique: true });

const categoryModel = mongoose.model("category", categorySchema);

module.exports = { categoryModel };
