const { getPool } = require('../db/pool');
const { ROOT_ADMIN_EMAIL, SCOPE_RANK } = require('../constants/adminAccess');

function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

function isRootUser(user) {
  if (!user) return false;
  return Boolean(user.is_root) || normalizeEmail(user.email) === ROOT_ADMIN_EMAIL;
}

function resolveScope(user) {
  if (!user) return 'none';
  if (isRootUser(user)) return 'full';
  if (user.role !== 'admin') return 'none';
  const scope = user.admin_scope || 'view';
  return SCOPE_RANK[scope] != null ? scope : 'view';
}

function hasMinScope(user, minScope) {
  return SCOPE_RANK[resolveScope(user)] >= SCOPE_RANK[minScope];
}

function buildCapabilities(user) {
  const scope = resolveScope(user);
  return {
    scope,
    canView: hasMinScope(user, 'view'),
    canEdit: hasMinScope(user, 'edit'),
    canFull: hasMinScope(user, 'full'),
    canCreateUsers: hasMinScope(user, 'full'),
    canManageRoles: hasMinScope(user, 'full'),
    canManageScope: hasMinScope(user, 'full'),
    canSuspend: hasMinScope(user, 'edit'),
    canDeletePermanent: hasMinScope(user, 'full'),
  };
}

function assertMinScope(user, minScope, message) {
  if (hasMinScope(user, minScope)) return;
  const err = new Error(message || 'Insufficient admin permission');
  err.status = 403;
  err.code = 'ADMIN_SCOPE_DENIED';
  throw err;
}

async function countFullAdmins(excludeUserId = null) {
  const params = [];
  let sql = `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND admin_scope = 'full'`;
  if (excludeUserId != null) {
    params.push(excludeUserId);
    sql += ` AND id != $${params.length}`;
  }
  const { rows } = await getPool().query(sql, params);
  return rows[0].count;
}

async function getRoleChangeBlockers(actorId, target, newRole) {
  const reasons = [];
  if (!target) return ['User not found'];
  if (!['user', 'admin'].includes(newRole)) return ['Invalid role'];
  if (target.role === newRole) return [];

  if (isRootUser(target) && newRole !== 'admin') {
    reasons.push('Root admin cannot be demoted.');
  }
  if (String(actorId) === String(target.id) && newRole !== 'admin') {
    reasons.push('You cannot remove your own admin role.');
  }
  if (target.role === 'admin' && newRole === 'user') {
    const fullOthers = await countFullAdmins(target.id);
    if (resolveScope(target) === 'full' && fullOthers === 0) {
      reasons.push('At least one full-scope admin must remain.');
    }
  }
  return reasons;
}

async function assertCanChangeRole(actorId, target, newRole) {
  const blockers = await getRoleChangeBlockers(actorId, target, newRole);
  if (blockers.length) {
    const err = new Error(blockers[0]);
    err.status = 400;
    err.code = 'ROLE_CHANGE_BLOCKED';
    throw err;
  }
}

function getScopeChangeBlockers(target, newScope) {
  const reasons = [];
  if (!['none', 'view', 'edit', 'full'].includes(newScope)) return ['Invalid admin scope'];
  if (isRootUser(target) && newScope !== 'full') {
    reasons.push('Root admin scope cannot be reduced.');
  }
  if (target.role !== 'admin' && newScope !== 'none') {
    reasons.push('Only admin accounts can have a scope.');
  }
  return reasons;
}

async function assertCanChangeScope(target, newScope) {
  const blockers = getScopeChangeBlockers(target, newScope);
  if (blockers.length) {
    const err = new Error(blockers[0]);
    err.status = 400;
    err.code = 'SCOPE_CHANGE_BLOCKED';
    throw err;
  }
}

function getSuspendBlockers(actorId, target, suspend) {
  const reasons = [];
  if (!target) return ['User not found'];
  if (!suspend) return [];
  if (isRootUser(target)) reasons.push('Root admin cannot be suspended.');
  if (String(actorId) === String(target.id)) reasons.push('You cannot suspend your own account.');
  return reasons;
}

async function assertCanSuspend(actorId, target, suspend) {
  const blockers = getSuspendBlockers(actorId, target, suspend);
  if (blockers.length) {
    const err = new Error(blockers[0]);
    err.status = 400;
    err.code = 'SUSPEND_BLOCKED';
    throw err;
  }
}

function getDeleteBlockers(actorId, target, fullAdminsExcludingTarget) {
  const reasons = [];
  if (!target) return ['User not found'];
  if (String(actorId) === String(target.id)) reasons.push('You cannot delete your own account.');
  if (isRootUser(target)) reasons.push('Root admin cannot be deleted.');
  if (target.role === 'admin' && resolveScope(target) === 'full' && fullAdminsExcludingTarget === 0) {
    reasons.push('Cannot delete the last full-scope admin.');
  }
  return reasons;
}

async function assertCanDelete(actorId, target) {
  const fullCount =
    target.role === 'admin' && resolveScope(target) === 'full'
      ? await countFullAdmins(target.id)
      : await countFullAdmins();
  const blockers = getDeleteBlockers(actorId, target, fullCount);
  if (blockers.length) {
    const err = new Error(blockers[0]);
    err.status = 400;
    err.code = 'DELETE_BLOCKED';
    throw err;
  }
}

async function buildTargetActions(actorId, target) {
  const isSelf = String(actorId) === String(target.id);
  const revokeRoleBlockers = await getRoleChangeBlockers(actorId, target, 'user');
  const grantRoleBlockers = await getRoleChangeBlockers(actorId, target, 'admin');
  const suspendBlockers = getSuspendBlockers(actorId, target, true);
  const fullCount =
    target.role === 'admin' && resolveScope(target) === 'full'
      ? await countFullAdmins(target.id)
      : await countFullAdmins();
  const deleteBlockers = getDeleteBlockers(actorId, target, fullCount);

  return {
    isRoot: isRootUser(target),
    isSelf,
    canSuspend: suspendBlockers.length === 0,
    canRestore: target.account_status === 'suspended' && suspendBlockers.length === 0,
    canDeletePermanent: deleteBlockers.length === 0,
    suspendBlockedReason: suspendBlockers[0] || null,
    deleteBlockedReason: deleteBlockers[0] || null,
    canGrantAdmin: grantRoleBlockers.length === 0,
    canRevokeAdmin: revokeRoleBlockers.length === 0,
    revokeAdminBlockedReason: revokeRoleBlockers[0] || null,
  };
}

function buildSession(user) {
  return {
    actor: {
      id: user.id,
      email: user.email,
      role: user.role,
      scope: resolveScope(user),
      isRoot: isRootUser(user),
    },
    capabilities: buildCapabilities(user),
    primaryAdminEmail: ROOT_ADMIN_EMAIL,
  };
}

module.exports = {
  ROOT_ADMIN_EMAIL,
  isRootUser,
  resolveScope,
  hasMinScope,
  buildCapabilities,
  buildSession,
  assertMinScope,
  assertCanChangeRole,
  assertCanChangeScope,
  assertCanSuspend,
  assertCanDelete,
  buildTargetActions,
  countFullAdmins,
};
