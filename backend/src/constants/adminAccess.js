const ROOT_ADMIN_EMAIL = 'admin@localhost';

const ADMIN_SCOPES = ['none', 'view', 'edit', 'full'];
const ACCOUNT_STATUSES = ['active', 'suspended'];

const SCOPE_RANK = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

module.exports = {
  ROOT_ADMIN_EMAIL,
  ADMIN_SCOPES,
  ACCOUNT_STATUSES,
  SCOPE_RANK,
};
