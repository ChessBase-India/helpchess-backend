const { error } = require('utils/logger');

const notesModel = require('models/notes');

module.exports = {
  getAll: async ({ page = 1, limit = 10 } = {}) => {
    try {
      const result = await notesModel.getAll({ page, limit });
      if (!result) {
        return { ok: false, msg: 'Unable to fetch notes.' };
      }
      return { ok: true, data: result };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  getById: async ({ id }) => {
    try {
      const note = await notesModel.getById({ id });
      if (!note) {
        return { ok: false, msg: 'Note not found.' };
      }
      return { ok: true, data: note };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  create: async ({ noteData }) => {
    try {
      const note = await notesModel.create({ noteData });
      if (!note) {
        return { ok: false, msg: 'Unable to create note!' };
      }
      return { ok: true, data: note };
    } catch (e) {
      error(e);
      if (e.name === 'ValidationError') {
        return { ok: false, msg: e.message };
      }
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  patch: async ({ id, updateData }) => {
    try {
      const note = await notesModel.patch({ id, updateData });
      if (!note) {
        return { ok: false, msg: 'Note not found or unable to update.' };
      }
      return { ok: true, data: note };
    } catch (e) {
      error(e);
      if (e.name === 'ValidationError') {
        return { ok: false, msg: e.message };
      }
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  delete: async ({ id }) => {
    try {
      const note = await notesModel.delete({ id });
      if (!note) {
        return { ok: false, msg: 'Note not found or already deleted.' };
      }
      return { ok: true, data: note };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  }
};
