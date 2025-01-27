const Role = require('../models/Role');
const { ApiError } = require('../utility/ApiError');

class RoleService {
  async createRole(data) {
    try {
      const role = new Role(data);
      return await role.save();
    } catch (error) {
      throw new ApiError(400, error.message);
    }
  }

  async getAllRoles(filter = {}) {
    return await Role.find({ ...filter, isActive: true })
      .populate('permissions');
  }

  async getRoleById(id) {
    const role = await Role.findById(id)
      .populate('permissions');
    if (!role) throw new ApiError(404, 'Role not found');
    return role;
  }

  async updateRole(id, data) {
    const role = await Role.findByIdAndUpdate(
      id,
      data,
      { new: true, runValidators: true }
    ).populate('permissions');
    
    if (!role) throw new ApiError(404, 'Role not found');
    return role;
  }

  async deleteRole(id) {
    const role = await Role.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!role) throw new ApiError(404, 'Role not found');
    return role;
  }

  async addPermissions(roleId, permissionIds) {
    const role = await Role.findById(roleId);
    if (!role) throw new ApiError(404, 'Role not found');

    role.permissions = [...new Set([...role.permissions, ...permissionIds])];
    return await role.save();
  }

  async removePermissions(roleId, permissionIds) {
    const role = await Role.findById(roleId);
    if (!role) throw new ApiError(404, 'Role not found');

    role.permissions = role.permissions.filter(
      p => !permissionIds.includes(p.toString())
    );
    return await role.save();
  }
}

module.exports = new RoleService();