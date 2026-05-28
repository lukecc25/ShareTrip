-- Migrate from Clerk user_profiles to accounts (safe to re-run partial steps)

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    fname TEXT NOT NULL,
    lname TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO accounts (id, fname, lname, email, phone, gender, password_hash)
SELECT clerk_user_id, fname, lname, email, phone, gender,
       '$2a$10$placeholder.cannot.login.until.reset'
FROM user_profiles
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user_profiles');

DROP TABLE IF EXISTS user_profiles;
