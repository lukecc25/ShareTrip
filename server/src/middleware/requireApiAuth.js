function requireApiAuth(req, res, next) {
  const userId = req.session?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  next();
}

module.exports = requireApiAuth;
