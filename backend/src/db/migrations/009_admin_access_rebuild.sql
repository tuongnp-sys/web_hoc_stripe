ALTER TABLE users ADD COLUMN IF NOT EXISTS is_root BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_scope TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS internal_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_status_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_account_status_check
      CHECK (account_status IN ('active', 'suspended'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_admin_scope_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_admin_scope_check
      CHECK (admin_scope IN ('none', 'view', 'edit', 'full'));
  END IF;
END $$;

UPDATE users
SET is_root = TRUE,
    role = 'admin',
    admin_scope = 'full',
    account_status = 'active',
    email_verified = TRUE
WHERE LOWER(email) = 'admin@localhost';

UPDATE users
SET admin_scope = 'none', account_status = COALESCE(NULLIF(account_status, ''), 'active')
WHERE role = 'user';

UPDATE users
SET admin_scope = 'view'
WHERE role = 'admin' AND is_root = FALSE AND admin_scope = 'none';
