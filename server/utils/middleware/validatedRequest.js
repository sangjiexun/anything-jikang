const { SystemSettings } = require("../../models/systemSettings");
const { User } = require("../../models/user");
const { EncryptionManager } = require("../EncryptionManager");
const { decodeJWT } = require("../http");
const EncryptionMgr = new EncryptionManager();

async function validatedRequest(request, response, next) {
  const multiUserMode = await SystemSettings.isMultiUserMode();
  response.locals.multiUserMode = multiUserMode;

  // 获取 auth token
  const auth = request.header("Authorization");
  const token = auth ? auth.split(" ")[1] : null;

  // 如果有 token，尝试多用户验证（无论 multiUserMode 设置如何）
  if (token) {
    const valid = decodeJWT(token);

    // 如果 token 包含 user id，使用多用户验证
    if (valid && valid.id) {
      const user = await User.get({ id: valid.id });
      if (!user) {
        response.status(401).json({
          error: "Invalid auth for user.",
        });
        return;
      }

      if (user.suspended) {
        response.status(401).json({
          error: "User is suspended from system",
        });
        return;
      }

      response.locals.user = user;
      response.locals.multiUserMode = true; // 强制标记为多用户模式
      next();
      return;
    }

    // 如果 token 包含 p 属性（单用户模式 token），验证它
    if (valid && valid.p) {
      const bcrypt = require("bcryptjs");
      const { p } = valid;

      if (p === null || !/\w{32}:\w{32}/.test(p)) {
        response.status(401).json({
          error: "Token expired or failed validation.",
        });
        return;
      }

      if (process.env.AUTH_TOKEN) {
        if (
          !bcrypt.compareSync(
            EncryptionMgr.decrypt(p),
            bcrypt.hashSync(process.env.AUTH_TOKEN, 10)
          )
        ) {
          response.status(401).json({
            error: "Invalid auth credentials.",
          });
          return;
        }
      }

      next();
      return;
    }

    // Token 无效
    response.status(401).json({
      error: "Invalid auth token.",
    });
    return;
  }

  // 没有 token 的情况
  // 在开发环境中，如果没有设置 AUTH_TOKEN，允许通过
  if (
    process.env.NODE_ENV === "development" &&
    !process.env.AUTH_TOKEN &&
    !process.env.JWT_SECRET
  ) {
    next();
    return;
  }

  // 需要 token 但没有提供
  response.status(401).json({
    error: "No auth token found.",
  });
}

async function validateMultiUserRequest(request, response, next) {
  const auth = request.header("Authorization");
  const token = auth ? auth.split(" ")[1] : null;

  if (!token) {
    response.status(401).json({
      error: "No auth token found.",
    });
    return;
  }

  const valid = decodeJWT(token);
  if (!valid || !valid.id) {
    response.status(401).json({
      error: "Invalid auth token.",
    });
    return;
  }

  const user = await User.get({ id: valid.id });
  if (!user) {
    response.status(401).json({
      error: "Invalid auth for user.",
    });
    return;
  }

  if (user.suspended) {
    response.status(401).json({
      error: "User is suspended from system",
    });
    return;
  }

  response.locals.user = user;
  next();
}

module.exports = {
  validatedRequest,
};
