/**
 * Cody Memory Database — SQLite-based storage with vec0 vector search + FTS5 full-text search.
 *
 * Brain-inspired 7-layer memory architecture:
 *   L0 Working   → current attention (in-memory)
 *   L1 Short-term → session continuity (session.jsonl, unchanged)
 *   L2 Episodic  → experiences with emotion weight + FSRS scheduling
 *   L3 Semantic   → facts + knowledge graph + Hebbian dynamics
 *   L4 Procedural → skills with success-rate weighting
 *   L5 Core       → identity/goals/preferences (never decay)
 *   L6 Cross-context → entity deduplication across domains
 *
 * Storage: Single SQLite file with FTS5 + vec0 virtual tables.
 * Embedding: all-MiniLM-L6-v2 (384-dim) via Transformers.js v4 (fully local).
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** 384-dim for all-MiniLM-L6-v2 */
export const EMBEDDING_DIMENSION = 384;

export class CodyMemoryDB {
  readonly db: Database.Database;
  private readonly dbPath: string;
  private _closed = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    mkdirSync(dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    // Load sqlite-vec extension
    sqliteVec.load(this.db);

    this.createSchema();
  }

  /** Create all tables and virtual tables */
  private createSchema(): void {
    // ── L2 Episodic Memory ─────────────────────────────────────
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        session_id TEXT,
        task TEXT NOT NULL,
        approach TEXT DEFAULT '',
        outcome TEXT NOT NULL DEFAULT 'partial',
        lessons TEXT DEFAULT '[]',            -- JSON array
        trajectory TEXT DEFAULT '[]',         -- JSON array
        user_feedback TEXT,
        self_assessment REAL,
        emotion_weight REAL DEFAULT 0.3,     -- Emotional significance 0-1
        stability REAL DEFAULT 1.0,          -- FSRS stability (days)
        difficulty REAL DEFAULT 5.0,         -- FSRS difficulty 1-10
        next_review TEXT,                     -- ISO datetime
        importance REAL DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        last_accessed TEXT DEFAULT (datetime('now')),
        tags TEXT DEFAULT '[]',              -- JSON array
        duration_ms INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // ── L3 Semantic Memory (Facts + Preferences + Knowledge) ───
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        fact_type TEXT DEFAULT 'fact',       -- fact | preference | knowledge | habit | insight | rule | context
        confidence REAL DEFAULT 0.9,
        source TEXT DEFAULT 'agent',         -- agent | user | system | evolution
        emotion_weight REAL DEFAULT 0.3,
        stability REAL DEFAULT 5.0,
        difficulty REAL DEFAULT 5.0,
        decay_class TEXT DEFAULT 'normal',   -- permanent | slow | normal | fast
        next_review TEXT,
        importance REAL DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        last_accessed TEXT DEFAULT (datetime('now')),
        tags TEXT DEFAULT '[]',
        related_ids TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // ── L4 Procedural Memory (Skills) ──────────────────────────
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        trigger_patterns TEXT DEFAULT '[]',  -- JSON array
        procedure TEXT NOT NULL DEFAULT '',
        origin TEXT DEFAULT 'manual',        -- manual | auto_generated | evolved
        success_rate REAL DEFAULT 0.0,
        use_count INTEGER DEFAULT 0,
        acceptance_rate REAL DEFAULT 0.0,
        avg_duration_ms REAL DEFAULT 0,
        refinement_count INTEGER DEFAULT 0,
        stability REAL DEFAULT 1.0,
        difficulty REAL DEFAULT 5.0,
        version INTEGER DEFAULT 1,
        evolved_from TEXT,
        evolution_generation INTEGER DEFAULT 0,
        importance REAL DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        last_accessed TEXT,
        last_used TEXT,
        tags TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // ── L5 Core Memory (Never decays, user-editable) ───────────
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS core_memory (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,              -- identity | goal | preference | constraint
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // ── L3 Knowledge Graph (Triples + Hebbian weights) ─────────
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS triples (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        confidence REAL DEFAULT 0.8,
        hebbian_weight REAL DEFAULT 0.5,     -- Hebbian learning weight
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // ── Vector Indexes (vec0) ──────────────────────────────────
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS episode_vectors USING vec0(
        embedding float[${EMBEDDING_DIMENSION}]
      )
    `);
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fact_vectors USING vec0(
        embedding float[${EMBEDDING_DIMENSION}]
      )
    `);
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS skill_vectors USING vec0(
        embedding float[${EMBEDDING_DIMENSION}]
      )
    `);

    // ── Full-Text Search Indexes (FTS5) ────────────────────────
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
        task, approach, lessons,
        content='episodes',
        content_rowid='rowid'
      )
    `);
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
        subject, content,
        content='facts',
        content_rowid='rowid'
      )
    `);

    // ── Indexes for performance ─────────────────────────────────
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_episodes_workspace ON episodes(workspace_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_episodes_outcome ON episodes(outcome)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_episodes_stability ON episodes(stability)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_facts_workspace ON facts(workspace_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_facts_type ON facts(fact_type)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_facts_decay ON facts(decay_class)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_workspace ON skills(workspace_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_triples_workspace ON triples(workspace_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_triples_subject ON triples(subject)`);

    // ── FTS sync triggers ───────────────────────────────────────
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
        INSERT INTO episodes_fts(rowid, task, approach, lessons) VALUES (
          NEW.rowid, NEW.task, NEW.approach, NEW.lessons
        );
      END
    `);
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS episodes_ad AFTER DELETE ON episodes BEGIN
        INSERT INTO episodes_fts(episodes_fts, rowid, task, approach, lessons) VALUES (
          'delete', OLD.rowid, OLD.task, OLD.approach, OLD.lessons
        );
      END
    `);
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
        INSERT INTO facts_fts(rowid, subject, content) VALUES (NEW.rowid, NEW.subject, NEW.content);
      END
    `);
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
        INSERT INTO facts_fts(facts_fts, rowid, subject, content) VALUES (
          'delete', OLD.rowid, OLD.subject, OLD.content
        );
      END
    `);
  }

  // ── Vector Operations ───────────────────────────────────────

  /** Insert a vector into the specified vec0 table */
  insertVector(table: string, id: number, embedding: number[]): Database.RunResult {
    const f32 = new Float32Array(embedding);
    const buf = Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
    // vec0 requires BigInt for rowid values
    return this.db.prepare(`INSERT OR REPLACE INTO ${table}(rowid, embedding) VALUES(?, ?)`).run(BigInt(id), buf);
  }

  /** Search vectors by cosine distance */
  searchVectors(table: string, queryEmbedding: number[], limit = 10): Array<{ rowid: number; distance: number }> {
    const f32 = new Float32Array(queryEmbedding);
    const buf = Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
    return this.db.prepare(
      `SELECT rowid, vec_distance_cosine(embedding, ?) AS distance
       FROM ${table}
       ORDER BY distance
       LIMIT ?`,
    ).all(buf, limit) as Array<{ rowid: number | bigint; distance: number }>;
  }

  /** Delete a vector by rowid */
  deleteVector(table: string, id: number): Database.RunResult {
    return this.db.prepare(`DELETE FROM ${table} WHERE rowid = ?`).run(BigInt(id));
  }

  // ── FTS5 Search ─────────────────────────────────────────────

  /** Full-text search on episodes */
  searchEpisodesFTS(query: string, limit = 10): Array<{ rowid: number; rank: number }> {
    // Escape FTS5 special characters by wrapping in quotes
    const safeQuery = '"' + query.replace(/"/g, '""') + '"';
    return this.db.prepare(
      `SELECT rowid, rank
       FROM episodes_fts
       WHERE episodes_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    ).all(safeQuery, limit) as Array<{ rowid: number; rank: number }>;
  }

  /** Full-text search on facts */
  searchFactsFTS(query: string, limit = 10): Array<{ rowid: number; rank: number }> {
    const safeQuery = '"' + query.replace(/"/g, '""') + '"';
    return this.db.prepare(
      `SELECT rowid, rank
       FROM facts_fts
       WHERE facts_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    ).all(safeQuery, limit) as Array<{ rowid: number; rank: number }>;
  }

  // ── Knowledge Graph ─────────────────────────────────────────

  /** Traverse KG from seed entities, returning connected nodes within depth */
  traverseKG(workspaceId: string, seedEntities: string[], _depth = 2, maxResults = 20): Array<{
    subject: string; predicate: string; object: string;
    confidence: number; hebbian_weight: number;
  }> {
    if (seedEntities.length === 0) return [];

    // Direct connections to seed entities (1-hop)
    const ph = seedEntities.map(() => '?').join(',');
    return this.db.prepare(
      `SELECT subject, predicate, object, confidence, hebbian_weight
       FROM triples
       WHERE workspace_id = ?
         AND (subject IN (${ph}) OR object IN (${ph}))
       ORDER BY hebbian_weight DESC
       LIMIT ?`,
    ).all(workspaceId, ...seedEntities, ...seedEntities, maxResults) as Array<{
      subject: string; predicate: string; object: string;
      confidence: number; hebbian_weight: number;
    }>;
  }

  // ── Lifecycle ───────────────────────────────────────────────

  /** Close the database */
  close(): void {
    if (!this._closed) {
      this.db.close();
      this._closed = true;
    }
  }

  get closed(): boolean {
    return this._closed;
  }
}
