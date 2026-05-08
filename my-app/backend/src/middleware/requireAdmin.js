export function requireAdmin(req, res, next) {
  req.adminEmail = 'admin'
  next()
}
