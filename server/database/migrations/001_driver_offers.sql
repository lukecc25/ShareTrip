-- Run on existing databases (safe to re-run)

ALTER TABLE rides ADD COLUMN assigned_driver_id TEXT;

CREATE TABLE IF NOT EXISTS driver_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    driver_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TEXT,
    UNIQUE (ride_id, driver_user_id),
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
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
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_driver_offers_ride ON driver_offers (ride_id);
CREATE INDEX IF NOT EXISTS idx_driver_offers_driver ON driver_offers (driver_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
