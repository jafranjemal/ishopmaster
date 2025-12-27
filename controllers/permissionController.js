const PermissionService = require("../services/PermissionService");
const { ApiError } = require("../utility/ApiError");



exports.bulkCreateAndAssignToRole = async (req, res, next) => {
  try {
    const { roleId, permissions } = req.body;

    if (!roleId || !permissions || !Array.isArray(permissions)) {
      throw new ApiError(400, 'Invalid request data');
    }

    // Validate permissions data
    await PermissionService.validateBulkOperations(permissions);

    // Create permissions and assign to role
    const result = await PermissionService.bulkCreateAndAssignToRole(
      permissions,
      roleId
    );

    res.status(201).json({
      success: true,
      message: `Successfully created and assigned ${result.permissions.length} permission(s)`,
      data: result
    });

  } catch (error) {
    next(error);
  }
};

exports.createPermissions = async (req, res) => {
  try {
    const permissionsData = Array.isArray(req.body) ? req.body : [req.body];

    // Validate permissions data
    await PermissionService.validateBulkOperations(permissionsData);

    // Create permissions
    const result = await PermissionService.bulkCreatePermissions(permissionsData);

    res.status(201).json({
      success: true,
      message: `Successfully created ${result.length} permission(s)`,
      data: result
    });

  } catch (error) {
    throw new ApiError(400, error.message);
  }
};
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await PermissionService.getAllPermissions();
    res.status(200).json(permissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPermissionByRole = async (req, res) => {
  try {
    const permission = await PermissionService.getPermissionByRole(req.params.role);
    // Note: If fetching by RoleID, this returns an ARRAY. If by module, an OBJECT.
    // The service might return empty array (valid) or null (not found for module).

    // Legacy support logic:
    if (!permission) {
      // If it was a module look-up and failed, we might want 404.
      // If it was a role look-up and empty array, that's fine (no permissions yet).
      res.status(200).json([]); // Return empty array safely
      return;
    }

    res.status(200).json(permission);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.updatePermission = async (req, res) => {
  try {
    const permission = await PermissionService.updatePermission(
      req.params.role,
      req.body
    );
    if (!permission) {
      throw new ApiError(404, 'Permissions not found');
    }
    res.status(200).json(permission);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

exports.deletePermission = async (req, res) => {
  try {
    const permission = await PermissionService.deletePermission(req.params.role);
    if (!permission) {
      throw new ApiError(404, 'Permissions not found');
    }
    res.status(200).json({ message: 'Permissions deleted successfully' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};