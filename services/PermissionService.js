const Permissions = require("../models/Permissions");
const Role = require("../models/Role");
const { ApiError } = require("../utility/ApiError");

class PermissionService {
  async createPermission({ module, actions, description }) {
    try {
      const permission = new Permissions({
        module,
        actions,
        description,
        isActive: true
      });
      return await permission.save();
    } catch (error) {
      throw new ApiError(400, error.message);
    }
  }

  async getAllPermissions(filter = {}) {
    return await Permissions.find({ ...filter, isActive: true });
  }

  async getPermissionByModule(module) {
    return await Permissions.findOne({ module, isActive: true });
  }

  async getPermissionsByRoleId(roleId) {
    return await Permissions.find({ roleId, isActive: true });
  }

  async getPermissionByRole(identifier) {
    // Check if identifier is a valid ObjectId (Role ID)
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      return await this.getPermissionsByRoleId(identifier);
    }
    // Fallback: Treat as module name (legacy/generic support)
    return await Permissions.findOne({ module: identifier, isActive: true });
  }

  async updatePermission(module, data) {
    return await Permissions.findOneAndUpdate(
      { module, isActive: true },
      data,
      { new: true, runValidators: true }
    );
  }

  async deletePermission(module) {
    return await Permissions.findOneAndUpdate(
      { module },
      { isActive: false },
      { new: true }
    );
  }

  async updateModuleActions(module, actions) {
    const permission = await Permissions.findOne({ module, isActive: true });
    if (!permission) {
      throw new ApiError(404, 'Permissions not found');
    }

    permission.actions = actions;
    return await permission.save();
  }

  async checkPermission(module, action) {
    const permission = await Permissions.findOne({
      module,
      actions: action,
      isActive: true
    });
    return !!permission;
  }

  async batchUpdatePermissions(permissions) {
    const operations = permissions.map(({ module, actions }) => ({
      updateOne: {
        filter: { module },
        update: { actions },
        upsert: true
      }
    }));

    return await Permissions.bulkWrite(operations);
  }

  async getModulePermissions(modules) {
    return await Permissions.find({
      module: { $in: modules },
      isActive: true
    });
  }

  async bulkCreatePermissions(permissionsData) {
    try {
      const permissions = permissionsData.map(data => ({
        module: data.module,
        actions: data.actions,
        // description: data.description,
        isActive: true
      }));

      return await Permissions.insertMany(permissions, { ordered: false });
    } catch (error) {
      throw new ApiError(400, 'Bulk create failed: ' + error.message);
    }
  }

  async bulkUpdatePermissions(updates) {
    try {
      const bulkOps = updates.map(({ module, actions, description }) => ({
        updateOne: {
          filter: { module, isActive: true },
          update: {
            $set: {
              actions,
              description,
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      }));

      const result = await Permissions.bulkWrite(bulkOps);

      return {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      };
    } catch (error) {
      throw new ApiError(400, 'Bulk update failed: ' + error.message);
    }
  }

  async validateBulkOperations(data) {
    const validModules = [
      'customers', 'dashboard', 'employee', 'items',
      'payments', 'pos', 'purchase', 'repair', 'sales',
      'shift', 'stock', 'suppliers', 'transactions', 'settings',
      'units', 'users', 'barcode', 'supplier', "customersAccount", "supplierAccount", "employeeAccount", "companyAccount"
    ];

    const validActions = ['view', 'create', 'edit', 'delete', 'export'];

    const invalidEntries = data.filter(
      item => !validModules.includes(item.module) ||
        !item.actions.every(action => validActions.includes(action))
    );

    if (invalidEntries.length > 0) {
      throw new ApiError(400, `Invalid entries found: ${JSON.stringify(invalidEntries.map(x => x.module))}`);
    }

    return true;
  }

  async bulkCreateAndAssignToRole(permissionsData, roleId) {
    try {
      // Create permissions
      const permissions = permissionsData.map(data => ({
        module: data.module,
        actions: data.actions,
        isActive: true,
        roleId
      }));

      // Validate permissions data
      if (!Array.isArray(permissionsData) || permissionsData.length === 0) {
        throw new ApiError(400, 'Invalid permissions data');
      }

      const role = await Role.findById(roleId);
      if (!role) {
        throw new ApiError(404, 'Role not found');
      }
      role.permissions = [] //remove all permission for the role

      await role.save()

      await Permissions.deleteMany({ roleId: roleId })



      const createdPermissions = await Permissions.insertMany(permissions, {
        ordered: false
      });

      // Get permission IDs
      const permissionIds = createdPermissions.map(p => p._id);

      // Update role with new permissions
      const updatedRole = await Role.findByIdAndUpdate(
        roleId,
        {
          $addToSet: {
            permissions: {
              $each: permissionIds
            }
          }
        },
        { new: true }
      ).populate('permissions');

      if (!updatedRole) {
        throw new ApiError(404, 'Role not found');
      }

      return {
        permissions: createdPermissions,
        role: updatedRole
      };
    } catch (error) {
      throw new ApiError(400, 'Bulk create and assign failed: ' + error.message);
    }
  }

  async assignPermissionsToRole(roleId, permissionIds) {
    try {
      const updatedRole = await Role.findByIdAndUpdate(
        roleId,
        {
          $addToSet: {
            permissions: {
              $each: permissionIds
            }
          }
        },
        { new: true }
      ).populate('permissions');

      if (!updatedRole) {
        throw new ApiError(404, 'Role not found');
      }

      return updatedRole;
    } catch (error) {
      throw new ApiError(400, 'Failed to assign permissions: ' + error.message);
    }
  }
}


module.exports = new PermissionService();