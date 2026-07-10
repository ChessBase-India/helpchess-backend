const { isValidObjectId } = require('mongoose');

const { error } = require('utils/logger');
const notesService = require('services/notes');

module.exports = {
  getAll: async (req, res) => {
    try {
      const { pageSize, page } = req.query;
      if (pageSize && (Number.isNaN(Number(pageSize)) || pageSize <= 0 || pageSize > 100)) {
        return res.invalid({ msg: 'Invalid pageSize' });
      }
      if (page && (Number.isNaN(Number(page)) || page <= 0)) {
        return res.invalid({ msg: 'Invalid page' });
      }

      const response = await notesService.getAll({
        limit: pageSize ? parseInt(pageSize, 10) : undefined,
        page: page ? parseInt(page, 10) : undefined
      });
      if (!response.ok || !response.data) {
        return res.failure({ msg: 'Unable to fetch notes!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  getById: async (req, res) => {
    try {
      const { noteId } = req.params;
      if (!noteId || !isValidObjectId(noteId)) {
        return res.invalid({ msg: 'Invalid/Missing note id' });
      }

      const response = await notesService.getById({ id: noteId });
      if (!response.ok || !response.data) {
        return res.invalid({ msg: response.msg || 'Note not found' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  create: async (req, res) => {
    try {
      const { title, content } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.invalid({ msg: 'Invalid/Missing title' });
      }
      if (content !== undefined && typeof content !== 'string') {
        return res.invalid({ msg: 'Invalid content' });
      }

      const noteData = {
        title: title.trim(),
        content,
        createdBy: req.userId
      };

      const response = await notesService.create({ noteData });
      if (!response.ok || !response.data) {
        return res.failure({ msg: response.msg || 'Unable to create note!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  patch: async (req, res) => {
    try {
      const { noteId } = req.params;
      const { title, content } = req.body;

      if (!noteId || !isValidObjectId(noteId)) {
        return res.invalid({ msg: 'Invalid/Missing note id' });
      }

      const updateData = {};
      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          return res.invalid({ msg: 'Invalid title' });
        }
        updateData.title = title.trim();
      }
      if (content !== undefined) {
        if (typeof content !== 'string') {
          return res.invalid({ msg: 'Invalid content' });
        }
        updateData.content = content;
      }

      if (Object.keys(updateData).length === 0) {
        return res.invalid({ msg: 'No valid fields to update' });
      }

      const response = await notesService.patch({ id: noteId, updateData });
      if (!response.ok || !response.data) {
        return res.failure({ msg: response.msg || 'Unable to update note!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  delete: async (req, res) => {
    try {
      const { noteId } = req.params;
      if (!noteId || !isValidObjectId(noteId)) {
        return res.invalid({ msg: 'Invalid/Missing note id' });
      }

      const response = await notesService.delete({ id: noteId });
      if (!response.ok || !response.data) {
        return res.failure({ msg: response.msg || 'Unable to delete note!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  }
};
