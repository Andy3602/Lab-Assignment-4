const express = require("express");
const mongoose = require("mongoose");
const { noteModel } = require("../model/note.model");
const { categoryModel } = require("../model/category.model");

const noteRouter = express.Router();
const getUserId = (req) => new mongoose.Types.ObjectId(req.user.id);

const noteQuery = (req) => {
  const userId = getUserId(req);
  const query = { userId };
  const view = req.query.view || "all";
  if (view === "trash") query.deletedAt = { $ne: null };
  else query.deletedAt = null;
  if (view === "favorites") query.isFavorite = true;
  if (view === "recent") query.updatedAt = { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) };
  if (req.query.category) query.categoryId = req.query.category;
  if (req.query.search) {
    const search = req.query.search.trim();
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }
  return query;
};

noteRouter.get("/", async (req, res) => {
  try {
    const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, updated: { updatedAt: -1 } };
    const notes = await noteModel.find(noteQuery(req)).populate("categoryId", "name").sort(sortMap[req.query.sort] || sortMap.newest);
    res.send({ notes });
  } catch (error) {
    res.status(500).send({ msg: "Unable to load notes" });
  }
});

noteRouter.get("/stats", async (req, res) => {
  try {
    const userId = getUserId(req);
    const [totalNotes, favoriteNotes, recentNotes, totalCategories] = await Promise.all([
      noteModel.countDocuments({ userId, deletedAt: null }),
      noteModel.countDocuments({ userId, deletedAt: null, isFavorite: true }),
      noteModel.countDocuments({ userId, deletedAt: null, updatedAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) } }),
      categoryModel.countDocuments({ userId }),
    ]);
    res.send({ stats: { totalNotes, favoriteNotes, recentNotes, totalCategories } });
  } catch (error) {
    res.status(500).send({ msg: "Unable to load statistics" });
  }
});

noteRouter.get("/:id", async (req, res) => {
  try {
    const note = await noteModel.findOne({ _id: req.params.id, userId: getUserId(req) }).populate("categoryId", "name");
    if (!note) return res.status(404).send({ msg: "Note not found" });
    res.send({ note });
  } catch (error) {
    res.status(500).send({ msg: "Unable to load note" });
  }
});

noteRouter.post("/", async (req, res) => {
  try {
    const { title, description, categoryId } = req.body;
    if (!title?.trim() || !description?.trim()) return res.status(400).send({ msg: "Title and description are required" });
    if (categoryId) {
      const category = await categoryModel.findOne({ _id: categoryId, userId: getUserId(req) });
      if (!category) return res.status(400).send({ msg: "Invalid category" });
    }
    const note = await noteModel.create({ userId: getUserId(req), title: title.trim(), description: description.trim(), categoryId: categoryId || null });
    res.status(201).send({ note: await note.populate("categoryId", "name") });
  } catch (error) {
    res.status(500).send({ msg: "Unable to create note" });
  }
});

noteRouter.patch("/:id", async (req, res) => {
  try {
    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.description !== undefined) updates.description = req.body.description.trim();
    if (req.body.isFavorite !== undefined) updates.isFavorite = Boolean(req.body.isFavorite);
    if (req.body.categoryId !== undefined) {
      if (req.body.categoryId) {
        const category = await categoryModel.findOne({ _id: req.body.categoryId, userId: getUserId(req) });
        if (!category) return res.status(400).send({ msg: "Invalid category" });
      }
      updates.categoryId = req.body.categoryId || null;
    }
    const note = await noteModel.findOneAndUpdate({ _id: req.params.id, userId: getUserId(req), deletedAt: null }, updates, { new: true, runValidators: true }).populate("categoryId", "name");
    if (!note) return res.status(404).send({ msg: "Note not found" });
    res.send({ note });
  } catch (error) {
    res.status(500).send({ msg: "Unable to update note" });
  }
});

noteRouter.delete("/:id", async (req, res) => {
  try {
    const note = await noteModel.findOneAndUpdate({ _id: req.params.id, userId: getUserId(req), deletedAt: null }, { deletedAt: new Date() }, { new: true });
    if (!note) return res.status(404).send({ msg: "Note not found" });
    res.send({ msg: "Note moved to trash" });
  } catch (error) {
    res.status(500).send({ msg: "Unable to delete note" });
  }
});

noteRouter.patch("/:id/restore", async (req, res) => {
  try {
    const note = await noteModel.findOneAndUpdate({ _id: req.params.id, userId: getUserId(req), deletedAt: { $ne: null } }, { deletedAt: null }, { new: true }).populate("categoryId", "name");
    if (!note) return res.status(404).send({ msg: "Note not found in trash" });
    res.send({ note });
  } catch (error) {
    res.status(500).send({ msg: "Unable to restore note" });
  }
});

noteRouter.delete("/:id/permanent", async (req, res) => {
  try {
    const note = await noteModel.findOneAndDelete({ _id: req.params.id, userId: getUserId(req), deletedAt: { $ne: null } });
    if (!note) return res.status(404).send({ msg: "Note not found in trash" });
    res.send({ msg: "Note permanently deleted" });
  } catch (error) {
    res.status(500).send({ msg: "Unable to permanently delete note" });
  }
});

module.exports = { noteRouter };
