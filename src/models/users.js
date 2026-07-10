const mongoose = require('mongoose');
const config = require('config');

const permissions = Object.values(config.get('internalAccess.permissions'));

const usersSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    admin: { type: Boolean, default: false },
    permissions: { type: [String], enum: permissions, default: [] },
    // password hash; hashing (e.g. bcrypt) is left to the consuming project's auth flow
    bcrypt: { type: String, required: true },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const UsersModel = mongoose.model('users', usersSchema, 'users');

module.exports = {
  findOne: async ({ query, projection }) => UsersModel.findOne(query, projection).lean(),

  getById: async ({ userId }) =>
    UsersModel.findOne({ _id: userId, isDeleted: { $ne: true } }).lean(),

  getUserWithPermissions: async ({ userId }) =>
    UsersModel.findOne(
      { _id: userId, isDeleted: { $ne: true } },
      { _id: 1, username: 1, admin: 1, permissions: 1, name: 1 }
    ).lean(),

  createUser: async ({ name, username, password, admin = false, userPermissions = [] }) => {
    const newUser = new UsersModel({
      name,
      username,
      admin,
      permissions: userPermissions,
      bcrypt: password // password should already be hashed when passed
    });
    return newUser.save();
  }
};
