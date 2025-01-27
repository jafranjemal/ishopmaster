const RoleService = require('../services/RoleService');
const { ApiError } = require('../utility/ApiError');

exports.createRole = async (req, res) => {
  try {
    const role = await RoleService.createRole(req.body);
    res.status(201).json({
      success: true,
      data: role
    });
  } catch (error) {
    throw new ApiError(error.statusCode || 400, error.message);
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    const roles = await RoleService.getAllRoles(req.query);
    res.status(200).json({
      success: true,
      data: roles
    });
  } catch (error) {
    throw new ApiError(error.statusCode || 500, error.message);
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const role = await RoleService.getRoleById(req.params.id);
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    throw new ApiError(error.statusCode || 404, error.message);
  }
};

exports.updateRole = async (req, res) => {
  try {
    const role = await RoleService.updateRole(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    throw new ApiError(error.statusCode || 400, error.message);
  }
};

exports.deleteRole = async (req, res) => {
  try {
    await RoleService.deleteRole(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    throw new ApiError(error.statusCode || 400, error.message);
  }
};

exports.addPermissions = async (req, res) => {
  try {
    const role = await RoleService.addPermissions(
      req.params.id,
      req.body.permissions
    );
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    throw new ApiError(error.statusCode || 400, error.message);
  }
};

exports.removePermissions = async (req, res) => {
  try {
    const role = await RoleService.removePermissions(
      req.params.id,
      req.body.permissions
    );
    res.status(200).json({
      success: true,
      data: role
    });
  } catch (error) {
    throw new ApiError(error.statusCode || 400, error.message);
  }
};