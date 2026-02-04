-- RLM SQLite schema (v1)

CREATE TABLE IF NOT EXISTS docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE,
  source TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER,
  layer TEXT, -- private | public
  content TEXT,
  tags TEXT,
  summary TEXT,
  FOREIGN KEY(doc_id) REFERENCES docs(id)
);

CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id INTEGER,
  model TEXT,
  vector BLOB,
  FOREIGN KEY(chunk_id) REFERENCES chunks(id)
);
