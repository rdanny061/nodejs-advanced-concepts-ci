const { clearHash } = require("../services/cache");

module.exports = async (req, res, next) => {
  await next();
  clearHash(req.user.id); // This function delete all data from this user
};
