const prisma = require('../config/database');

async function logAction(action, entity, entityId, details, userId) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId || null,
        details: JSON.stringify(details),
        userId,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

function auditMiddleware(action, entity) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const userId = req.user?.id;

    res.json = function(data) {
      logAction(action, entity, data?.id || req.params?.id, {
        method: req.method,
        path: req.path,
        body: sanitizeBody(req.body),
        statusCode: res.statusCode,
      }, userId);
      return originalJson(data);
    };

    res.send = function(data) {
      logAction(action, entity, req.params?.id, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      }, userId);
      return originalSend(data);
    };

    next();
  };
}

function sanitizeBody(body) {
  if (!body) return {};
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.confirmPassword;
  return sanitized;
}

module.exports = { logAction, auditMiddleware };
