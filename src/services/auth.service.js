const { User } = require('../models/User');
const { Token } = require('../models/Token');
const bcrypt = require('bcryptjs');
const { tokenTypes } = require('../config/tokens');
const userService = require('./user.service');
const tokenService = require('./token.service');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await userService.isPasswordMatch(password, user.dataValues))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  const { id, username, profile_image, role } = user;
  return (userObj = {
    id,
    username,
    profile_image,
    role,
  });
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
const logout = async (refreshToken) => {
  const refreshTokenDoc = await Token.findOne({
    where: { token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false },
  });
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await refreshTokenDoc.destroy();
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(refreshToken, tokenTypes.REFRESH);

    console.log(refreshTokenDoc.dataValues.user);
    const user = await userService.getUserById(refreshTokenDoc.dataValues.user);

    if (!user) {
      throw new Error();
    }
    await refreshTokenDoc.destroy();
    return tokenService.generateAuthTokens(user.id);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise}
 */
const resetPassword = async (resetPasswordToken, newPassword) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
    const user = await userService.getUserById(resetPasswordTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    const password = await bcrypt.hashSync(newPassword, 10);
    await userService.updateUserById(user.id, { password });
    await Token.destroy({ where: { user: user.id, type: tokenTypes.RESET_PASSWORD } });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

/**
 * Verify email
 * @param {string} verifyEmailToken
 * @returns {Promise}
 */
const verifyEmail = async (verifyEmailToken) => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
    const user = await userService.getUserById(verifyEmailTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    await Token.destroy({ where: { user: user.id, type: tokenTypes.VERIFY_EMAIL } });
    await userService.updateUserById(user.id, { isEmailVerified: true });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};

module.exports = { loginUserWithEmailAndPassword, logout, refreshAuth, resetPassword, verifyEmail };
