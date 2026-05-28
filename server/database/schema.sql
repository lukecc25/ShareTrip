-- ShareTrip schema

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

CREATE TABLE IF NOT EXISTS rides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    ride_type TEXT NOT NULL CHECK (ride_type IN ('offer', 'request')),
    roundtrip INTEGER NOT NULL DEFAULT 0 CHECK (roundtrip IN (0, 1)),
    seats INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    ride_cost REAL NOT NULL DEFAULT 0,
    gender_preference TEXT NOT NULL DEFAULT 'No preference'
        CHECK (gender_preference IN ('Same gender only', 'No preference')),
    assigned_driver_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS driver_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    driver_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TEXT,
    UNIQUE (ride_id, driver_user_id),
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_user_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    ride_id INTEGER,
    offer_id INTEGER,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    read_flag INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS passengers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ride_id, user_id),
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    rated_user_id TEXT NOT NULL,
    rater_user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ride_id, rated_user_id, rater_user_id),
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts (email);
CREATE INDEX IF NOT EXISTS idx_rides_owner ON rides (owner_id);
CREATE INDEX IF NOT EXISTS idx_rides_start_date ON rides (start_date);
CREATE INDEX IF NOT EXISTS idx_passengers_ride ON passengers (ride_id);
CREATE INDEX IF NOT EXISTS idx_passengers_user ON passengers (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_ride ON comments (ride_id);
CREATE INDEX IF NOT EXISTS idx_ratings_ride ON ratings (ride_id);
CREATE INDEX IF NOT EXISTS idx_driver_offers_ride ON driver_offers (ride_id);
CREATE INDEX IF NOT EXISTS idx_driver_offers_driver ON driver_offers (driver_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
