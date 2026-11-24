const express = require("express");
const mongoose = require("mongoose");
const { categoryModel } = require("../model/category.model");
const { noteModel } = require("../model/note.model");

const categoryRouter = express.Router();

const getUserId = (req) => new mongoose.Types.ObjectId(req.user.id);

categoryRouter.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    const categories = await categoryModel.aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: "notes",
          let: { categoryId: "$_id", ownerId: "$userId" },
          pipeline: [{ $match: { $expr: { $and: [
            { $eq: ["$categoryId", "$$categoryId"] },
            { $eq: ["$userId", "$$ownerId"] },
            { $eq: ["$deletedAt", null] },
          ] } } }],
          as: "notes",
        },
      },
      { $addFields: { noteCount: { $size: "$notes" } } },
      { $project: { notes: 0, nameKey: 0 } },
      { $sort: { name: 1 } },
    ]);
    res.send({ categories });
  } catch (error) {
    res.status(500).send({ msg: "Unable to load categories" });
  }
});

categoryRouter.post("/", async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).send({ msg: "Category name is required" });

    const category = await categoryModel.create({
      userId: getUserId(req),
      name,
      nameKey: name.toLowerCase(),
    });
    res.status(201).send({ category: { ...category.toObject(), noteCount: 0 } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).send({ msg: "Category already exists" });
    res.status(500).send({ msg: "Unable to create category" });
  }
});

categoryRouter.patch("/:id", async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).send({ msg: "Category name is required" });

    const category = await categoryModel.findOneAndUpdate(
      { _id: req.params.id, userId: getUserId(req) },
      { name, nameKey: name.toLowerCase() },
      { new: true, runValidators: true },
    );
    if (!category) return res.status(404).send({ msg: "Category not found" });
    res.send({ category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).send({ msg: "Category already exists" });
    res.status(500).send({ msg: "Unable to update category" });
  }
});

categoryRouter.delete("/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const category = await categoryModel.findOneAndDelete({ _id: req.params.id, userId });
    if (!category) return res.status(404).send({ msg: "Category not found" });
    await noteModel.updateMany({ userId, categoryId: category._id }, { $set: { categoryId: null } });
    res.send({ msg: "Category deleted" });
  } catch (error) {
    res.status(500).send({ msg: "Unable to delete category" });
  }
});

module.exports = { categoryRouter };
