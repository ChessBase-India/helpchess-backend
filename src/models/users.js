const mongoose = require('mongoose');

const usersSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'roles', required: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

usersSchema.pre('save', function setFullName(next) {
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.fullName = `${this.firstName} ${this.lastName}`.trim();
  }
  next();
});

usersSchema.index({ email: 1 });
usersSchema.index({ status: 1 });
usersSchema.index({ isDeleted: 1 });

const UsersModel = mongoose.model('users', usersSchema, 'users');

const ROLE_POPULATE = { path: 'roleId', select: 'name code permissions status' };

module.exports = {
  findByEmail: async ({ email }) =>
    UsersModel.findOne({ email: email.toLowerCase(), isDeleted: { $ne: true } }).lean(),

  findByEmailForAuth: async ({ email }) =>
    UsersModel.findOne({ email: email.toLowerCase(), isDeleted: { $ne: true } })
      .select('+passwordHash')
      .lean(),

  findOne: async ({ query, projection }) => UsersModel.findOne(query, projection).lean(),

  getById: async ({ userId }) =>
    UsersModel.findOne({ _id: userId, isDeleted: { $ne: true } }).lean(),

  getByIdWithRole: async ({ userId }) =>
    UsersModel.findOne({ _id: userId, isDeleted: { $ne: true } })
      .populate(ROLE_POPULATE)
      .lean(),

  getAll: async ({ page = 1, limit = 10, status } = {}) => {
    const skip = (page - 1) * limit;
    const filter = { isDeleted: { $ne: true } };
    if (status) {
      filter.status = status;
    }
    const [items, total] = await Promise.all([
      UsersModel.find(filter)
        .populate(ROLE_POPULATE)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UsersModel.countDocuments(filter)
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  createUser: async ({ userData }) => {
    const user = new UsersModel(userData);
    return user.save();
  },

  patchUser: async ({ userId, updateData }) => {
    const update = { ...updateData };
    if (update.firstName !== undefined || update.lastName !== undefined) {
      const existing = await UsersModel.findOne(
        { _id: userId, isDeleted: { $ne: true } },
        { firstName: 1, lastName: 1 }
      ).lean();
      if (!existing) {
        return null;
      }
      const firstName = update.firstName ?? existing.firstName;
      const lastName = update.lastName ?? existing.lastName;
      update.fullName = `${firstName} ${lastName}`.trim();
    }
    return UsersModel.findOneAndUpdate({ _id: userId, isDeleted: { $ne: true } }, update, {
      new: true
    })
      .populate(ROLE_POPULATE)
      .lean();
  },

  updateLastLogin: async ({ userId }) =>
    UsersModel.findOneAndUpdate(
      { _id: userId, isDeleted: { $ne: true } },
      { lastLoginAt: new Date() },
      { new: true }
    ).lean()
};
