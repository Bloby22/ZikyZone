CREATE TABLE IF NOT EXISTS economy (
  user_id TEXT PRIMARY KEY,
  zcoins INTEGER DEFAULT 0,
  daily_streak INTEGER DEFAULT 0,
  weekly_streak INTEGER DEFAULT 0,
  last_daily DATE,
  last_weekly INTEGER
);
