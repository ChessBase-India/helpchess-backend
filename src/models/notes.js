const mongoose = require('mongoose');

const notesSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, default: '' },
    createdBy: { type: String, required: false },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notesSchema.index({ isDeleted: 1 });
notesSchema.index({ createdAt: -1 });

const NotesModel = mongoose.model('notes', notesSchema, 'notes');

module.exports = {
  getAll: async ({ page = 1, limit = 10 } = {}) => {
    const skip = (page - 1) * limit;
    const filter = { isDeleted: false };
    const [items, total] = await Promise.all([
      NotesModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotesModel.countDocuments(filter)
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  getById: async ({ id }) => NotesModel.findOne({ _id: id, isDeleted: false }).lean(),

  create: async ({ noteData }) => new NotesModel(noteData).save(),

  patch: async ({ id, updateData }) =>
    NotesModel.findOneAndUpdate({ _id: id, isDeleted: false }, updateData, { new: true }).lean(),

  delete: async ({ id }) =>
    NotesModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true }).lean()
};
