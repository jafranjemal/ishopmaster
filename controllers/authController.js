const AuthService = require('../services/AuthService');
 
exports.login = async (req, res , next) => {
  try {
    const { username, password } = req.body;
    const result = await AuthService.login(username, password);
    
    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.log(error.statusCode);
   next(error);
  }
};