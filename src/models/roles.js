const mongoose = require('mongoose');

const rolesSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

rolesSchema.index({ code: 1 });
rolesSchema.index({ status: 1 });

const RolesModel = mongoose.model('roles', rolesSchema, 'roles');

module.exports = {
  findOne: async ({ query, projection }) => RolesModel.findOne(query, projection).lean(),

  getById: async ({ roleId }) => RolesModel.findOne({ _id: roleId }).lean(),

  getAll: async ({ page = 1, limit = 50, status } = {}) => {
    const skip = (page - 1) * limit;
    const filter = {};
    if (status) {
      filter.status = status;
    }
    const [items, total] = await Promise.all([
      RolesModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      RolesModel.countDocuments(filter)
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  create: async ({ roleData }) => new RolesModel(roleData).save(),

  patch: async ({ roleId, updateData }) =>
    RolesModel.findOneAndUpdate({ _id: roleId }, updateData, { new: true }).lean()
};
