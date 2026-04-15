use rusqlite::{Connection, Row};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Question {
  pub id: String,
  pub title: Option<String>,
  pub prompt: Option<String>,
  pub framework: String,
  #[serde(rename = "type")]
  pub question_type: String,
  pub tags: Option<Vec<String>>,
  pub difficulty: Option<String>,
  pub source: Option<String>,
  pub reference_answer: Option<String>,
  pub common_errors: Option<Vec<String>>,
  pub is_mistake: Option<i32>,
  pub content: Option<String>,
  pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct Message {
  pub role: String,
  pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PracticeRecord {
  pub id: String,
  pub practiced_at: String,
  pub question_id: String,
  pub framework: String,
  pub overall_score: Option<f64>,
  pub attempt: Option<i32>,
  pub duration_seconds: Option<i32>,
  pub dimension_scores: Option<serde_json::Value>,
  pub issue_list: Option<Vec<String>>,
  pub optimized_answer: Option<String>,
  pub user_answer: Option<String>,
  pub outline: Option<String>,
  pub ai_feedback: Option<String>,
  pub ai_optimized_version: Option<String>,
  pub messages: Option<Vec<Message>>,
  pub is_time_expired: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Principle {
  pub id: String,
  pub title: String,
  pub content: String,
  pub tags: Option<Vec<String>>,
  pub created_at: Option<String>,
  pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  pub id: i32,
  pub mistake_threshold: Option<i32>,
  pub default_model: Option<String>,
  pub practice_duration_seconds: Option<i32>,
  pub deepseek_api_key: Option<String>,
  pub deepseek_api_url: Option<String>,
  pub strict_sketch_mode: Option<bool>,
  pub language: Option<String>,
}

pub fn init_db(conn: &Connection) -> Result<(), rusqlite::Error> {
  conn.execute(
    "CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      framework TEXT NOT NULL,
      title TEXT,
      prompt TEXT,
      content TEXT,
      reference_answer TEXT,
      difficulty TEXT,
      source TEXT,
      is_mistake INTEGER DEFAULT 0,
      tags TEXT,
      common_errors TEXT,
      created_at TEXT
    )",
    [],
  )?;

  conn.execute(
    "CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      framework TEXT NOT NULL,
      practiced_at TEXT NOT NULL,
      overall_score REAL,
      attempt INTEGER,
      duration_seconds INTEGER,
      dimension_scores TEXT,
      issue_list TEXT,
      user_answer TEXT,
      outline TEXT,
      ai_feedback TEXT,
      ai_optimized_version TEXT,
      optimized_answer TEXT,
      messages TEXT,
      is_time_expired INTEGER
    )",
    [],
  )?;

  conn.execute(
    "CREATE TABLE IF NOT EXISTS principles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TEXT,
      updated_at TEXT
    )",
    [],
  )?;

  conn.execute(
    "CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      deepseek_api_key TEXT,
      deepseek_api_url TEXT,
      default_model TEXT,
      mistake_threshold INTEGER DEFAULT 6,
      practice_duration_seconds INTEGER DEFAULT 300,
      strict_sketch_mode INTEGER DEFAULT 0,
      language TEXT
    )",
    [],
  )?;

  let _ = conn.execute("ALTER TABLE settings ADD COLUMN language TEXT", []);

  conn.execute("INSERT OR IGNORE INTO settings (id) VALUES (1)", [])?;

  Ok(())
}

fn camel_to_snake(s: &str) -> String {
  let mut result = String::new();
  for (i, ch) in s.chars().enumerate() {
    if ch.is_uppercase() {
      if i > 0 {
        result.push('_');
      }
      result.extend(ch.to_lowercase());
    } else {
      result.push(ch);
    }
  }
  result
}

fn json_value_to_sql(val: &serde_json::Value) -> rusqlite::types::Value {
  match val {
    serde_json::Value::Null => rusqlite::types::Value::Null,
    serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(*b as i64),
    serde_json::Value::Number(n) => {
      if let Some(i) = n.as_i64() {
        rusqlite::types::Value::Integer(i)
      } else {
        rusqlite::types::Value::Real(n.as_f64().unwrap_or(0.0))
      }
    }
    serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
    serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
      rusqlite::types::Value::Text(val.to_string())
    }
  }
}

fn row_to_question(row: &Row) -> Result<Question, rusqlite::Error> {
  let tags_json: Option<String> = row.get("tags")?;
  let common_errors_json: Option<String> = row.get("common_errors")?;
  Ok(Question {
    id: row.get("id")?,
    question_type: row.get("type")?,
    framework: row.get("framework")?,
    title: row.get("title")?,
    prompt: row.get("prompt")?,
    content: row.get("content")?,
    reference_answer: row.get("reference_answer")?,
    difficulty: row.get("difficulty")?,
    source: row.get("source")?,
    is_mistake: row.get("is_mistake")?,
    tags: tags_json.and_then(|s| serde_json::from_str(&s).ok()),
    common_errors: common_errors_json.and_then(|s| serde_json::from_str(&s).ok()),
    created_at: row.get("created_at")?,
  })
}

fn row_to_record(row: &Row) -> Result<PracticeRecord, rusqlite::Error> {
  let dimension_scores_json: Option<String> = row.get("dimension_scores")?;
  let issue_list_json: Option<String> = row.get("issue_list")?;
  let messages_json: Option<String> = row.get("messages")?;
  Ok(PracticeRecord {
    id: row.get("id")?,
    question_id: row.get("question_id")?,
    framework: row.get("framework")?,
    practiced_at: row.get("practiced_at")?,
    overall_score: row.get("overall_score")?,
    attempt: row.get("attempt")?,
    duration_seconds: row.get("duration_seconds")?,
    dimension_scores: dimension_scores_json.and_then(|s| serde_json::from_str(&s).ok()),
    issue_list: issue_list_json.and_then(|s| serde_json::from_str(&s).ok()),
    user_answer: row.get("user_answer")?,
    outline: row.get("outline")?,
    ai_feedback: row.get("ai_feedback")?,
    ai_optimized_version: row.get("ai_optimized_version")?,
    optimized_answer: row.get("optimized_answer")?,
    messages: messages_json.and_then(|s| serde_json::from_str(&s).ok()),
    is_time_expired: row.get("is_time_expired")?,
  })
}

fn row_to_principle(row: &Row) -> Result<Principle, rusqlite::Error> {
  let tags_json: Option<String> = row.get("tags")?;
  Ok(Principle {
    id: row.get("id")?,
    title: row.get("title")?,
    content: row.get("content")?,
    tags: tags_json.and_then(|s| serde_json::from_str(&s).ok()),
    created_at: row.get("created_at")?,
    updated_at: row.get("updated_at")?,
  })
}

fn db_get_all_questions(conn: &Connection) -> Result<Vec<Question>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, type, framework, title, prompt, content, reference_answer, difficulty, source, is_mistake, tags, common_errors, created_at FROM questions",
    )
    .map_err(|e| e.to_string())?;
  let questions = stmt
    .query_map([], row_to_question)
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
  Ok(questions)
}

fn db_get_question_by_id(conn: &Connection, id: &str) -> Result<Option<Question>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, type, framework, title, prompt, content, reference_answer, difficulty, source, is_mistake, tags, common_errors, created_at FROM questions WHERE id = ?1",
    )
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query_map([id], row_to_question).map_err(|e| e.to_string())?;
  Ok(rows.next().transpose().map_err(|e| e.to_string())?)
}

fn db_add_question(conn: &Connection, question: Question) -> Result<String, String> {
  let id = question.id.clone();
  let tags_json = question.tags.as_ref().map(|v| serde_json::to_string(v).unwrap());
  let common_errors_json = question
    .common_errors
    .as_ref()
    .map(|v| serde_json::to_string(v).unwrap());
  conn
    .execute(
      "INSERT INTO questions (id, type, framework, title, prompt, content, reference_answer, difficulty, source, is_mistake, tags, common_errors, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
      rusqlite::params![
        question.id,
        question.question_type,
        question.framework,
        question.title,
        question.prompt,
        question.content,
        question.reference_answer,
        question.difficulty,
        question.source,
        question.is_mistake,
        tags_json,
        common_errors_json,
        question.created_at,
      ],
    )
    .map_err(|e| e.to_string())?;
  Ok(id)
}

fn db_update_question(
  conn: &Connection,
  id: &str,
  changes: serde_json::Value,
) -> Result<(), String> {
  let obj = changes.as_object().ok_or("changes must be an object")?;
  if obj.is_empty() {
    return Ok(());
  }
  let mut sets = Vec::new();
  let mut params: Vec<rusqlite::types::Value> = Vec::new();
  for (key, val) in obj {
    let col = camel_to_snake(key);
    sets.push(format!("{} = ?", col));
    params.push(json_value_to_sql(val));
  }
  params.push(rusqlite::types::Value::Text(id.to_string()));
  let sql = format!("UPDATE questions SET {} WHERE id = ?", sets.join(", "));
  conn
    .execute(&sql, rusqlite::params_from_iter(params))
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn db_delete_question(conn: &mut Connection, id: &str) -> Result<(), String> {
  let tx = conn.transaction().map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM records WHERE question_id = ?", [id])
    .map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM questions WHERE id = ?", [id])
    .map_err(|e| e.to_string())?;
  tx.commit().map_err(|e| e.to_string())?;
  Ok(())
}

fn db_get_all_records(conn: &Connection) -> Result<Vec<PracticeRecord>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, question_id, framework, practiced_at, overall_score, attempt, duration_seconds, dimension_scores, issue_list, user_answer, outline, ai_feedback, ai_optimized_version, optimized_answer, messages, is_time_expired FROM records",
    )
    .map_err(|e| e.to_string())?;
  let records = stmt
    .query_map([], row_to_record)
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
  Ok(records)
}

fn db_get_record_by_id(
  conn: &Connection,
  id: &str,
) -> Result<Option<PracticeRecord>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, question_id, framework, practiced_at, overall_score, attempt, duration_seconds, dimension_scores, issue_list, user_answer, outline, ai_feedback, ai_optimized_version, optimized_answer, messages, is_time_expired FROM records WHERE id = ?1",
    )
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query_map([id], row_to_record).map_err(|e| e.to_string())?;
  Ok(rows.next().transpose().map_err(|e| e.to_string())?)
}

fn db_get_records_by_question_id(
  conn: &Connection,
  question_id: &str,
) -> Result<Vec<PracticeRecord>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, question_id, framework, practiced_at, overall_score, attempt, duration_seconds, dimension_scores, issue_list, user_answer, outline, ai_feedback, ai_optimized_version, optimized_answer, messages, is_time_expired FROM records WHERE question_id = ?1 ORDER BY practiced_at ASC",
    )
    .map_err(|e| e.to_string())?;
  let records = stmt
    .query_map([question_id], row_to_record)
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
  Ok(records)
}

fn db_add_record(conn: &Connection, record: PracticeRecord) -> Result<String, String> {
  let id = record.id.clone();
  let dimension_scores_json = record
    .dimension_scores
    .as_ref()
    .map(|v| serde_json::to_string(v).unwrap());
  let issue_list_json = record
    .issue_list
    .as_ref()
    .map(|v| serde_json::to_string(v).unwrap());
  let messages_json = record
    .messages
    .as_ref()
    .map(|v| serde_json::to_string(v).unwrap());
  conn
    .execute(
      "INSERT INTO records (id, question_id, framework, practiced_at, overall_score, attempt, duration_seconds, dimension_scores, issue_list, user_answer, outline, ai_feedback, ai_optimized_version, optimized_answer, messages, is_time_expired)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
      rusqlite::params![
        record.id,
        record.question_id,
        record.framework,
        record.practiced_at,
        record.overall_score,
        record.attempt,
        record.duration_seconds,
        dimension_scores_json,
        issue_list_json,
        record.user_answer,
        record.outline,
        record.ai_feedback,
        record.ai_optimized_version,
        record.optimized_answer,
        messages_json,
        record.is_time_expired,
      ],
    )
    .map_err(|e| e.to_string())?;
  Ok(id)
}

fn db_update_record(
  conn: &Connection,
  id: &str,
  changes: serde_json::Value,
) -> Result<(), String> {
  let obj = changes.as_object().ok_or("changes must be an object")?;
  if obj.is_empty() {
    return Ok(());
  }
  let mut sets = Vec::new();
  let mut params: Vec<rusqlite::types::Value> = Vec::new();
  for (key, val) in obj {
    let col = camel_to_snake(key);
    sets.push(format!("{} = ?", col));
    params.push(json_value_to_sql(val));
  }
  params.push(rusqlite::types::Value::Text(id.to_string()));
  let sql = format!("UPDATE records SET {} WHERE id = ?", sets.join(", "));
  conn
    .execute(&sql, rusqlite::params_from_iter(params))
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn db_get_all_principles(conn: &Connection) -> Result<Vec<Principle>, String> {
  let mut stmt = conn
    .prepare("SELECT id, title, content, tags, created_at, updated_at FROM principles")
    .map_err(|e| e.to_string())?;
  let principles = stmt
    .query_map([], row_to_principle)
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
  Ok(principles)
}

fn db_get_principle_by_id(
  conn: &Connection,
  id: &str,
) -> Result<Option<Principle>, String> {
  let mut stmt = conn
    .prepare("SELECT id, title, content, tags, created_at, updated_at FROM principles WHERE id = ?1")
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query_map([id], row_to_principle).map_err(|e| e.to_string())?;
  Ok(rows.next().transpose().map_err(|e| e.to_string())?)
}

fn db_add_principle(conn: &Connection, principle: Principle) -> Result<String, String> {
  let id = principle.id.clone();
  let tags_json = principle.tags.as_ref().map(|v| serde_json::to_string(v).unwrap());
  conn
    .execute(
      "INSERT INTO principles (id, title, content, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      rusqlite::params![
        principle.id,
        principle.title,
        principle.content,
        tags_json,
        principle.created_at,
        principle.updated_at,
      ],
    )
    .map_err(|e| e.to_string())?;
  Ok(id)
}

fn db_update_principle(
  conn: &Connection,
  id: &str,
  changes: serde_json::Value,
) -> Result<(), String> {
  let obj = changes.as_object().ok_or("changes must be an object")?;
  if obj.is_empty() {
    return Ok(());
  }
  let mut sets = Vec::new();
  let mut params: Vec<rusqlite::types::Value> = Vec::new();
  for (key, val) in obj {
    let col = camel_to_snake(key);
    sets.push(format!("{} = ?", col));
    params.push(json_value_to_sql(val));
  }
  params.push(rusqlite::types::Value::Text(id.to_string()));
  let sql = format!("UPDATE principles SET {} WHERE id = ?", sets.join(", "));
  conn
    .execute(&sql, rusqlite::params_from_iter(params))
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn db_delete_principle(conn: &Connection, id: &str) -> Result<(), String> {
  conn
    .execute("DELETE FROM principles WHERE id = ?", [id])
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn db_get_settings(conn: &Connection) -> Result<Option<AppSettings>, String> {
  let mut stmt = conn
    .prepare(
      "SELECT id, deepseek_api_key, deepseek_api_url, default_model, mistake_threshold, practice_duration_seconds, strict_sketch_mode, language FROM settings WHERE id = 1",
    )
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
  if let Some(row) = rows.next().map_err(|e| e.to_string())? {
    Ok(Some(AppSettings {
      id: row.get("id").map_err(|e| e.to_string())?,
      deepseek_api_key: row.get("deepseek_api_key").map_err(|e| e.to_string())?,
      deepseek_api_url: row.get("deepseek_api_url").map_err(|e| e.to_string())?,
      default_model: row.get("default_model").map_err(|e| e.to_string())?,
      mistake_threshold: row.get("mistake_threshold").map_err(|e| e.to_string())?,
      practice_duration_seconds: row.get("practice_duration_seconds").map_err(|e| e.to_string())?,
      strict_sketch_mode: row.get("strict_sketch_mode").map_err(|e| e.to_string())?,
      language: row.get("language").map_err(|e| e.to_string())?,
    }))
  } else {
    Ok(None)
  }
}

fn db_update_settings(
  conn: &mut Connection,
  changes: serde_json::Value,
) -> Result<(), String> {
  let tx = conn.transaction().map_err(|e| e.to_string())?;
  tx.execute("INSERT OR IGNORE INTO settings (id) VALUES (1)", [])
    .map_err(|e| e.to_string())?;
  let obj = changes.as_object().ok_or("changes must be an object")?;
  if !obj.is_empty() {
    let mut sets = Vec::new();
    let mut params: Vec<rusqlite::types::Value> = Vec::new();
    for (key, val) in obj {
      if key == "id" {
        continue;
      }
      let col = camel_to_snake(key);
      sets.push(format!("{} = ?", col));
      params.push(json_value_to_sql(val));
    }
    if !sets.is_empty() {
      let sql = format!("UPDATE settings SET {} WHERE id = 1", sets.join(", "));
      tx.execute(&sql, rusqlite::params_from_iter(params))
        .map_err(|e| e.to_string())?;
    }
  }
  tx.commit().map_err(|e| e.to_string())?;
  Ok(())
}

fn db_get_mistake_questions(conn: &Connection) -> Result<Vec<Question>, String> {
  let threshold: i32 = conn
    .query_row(
      "SELECT COALESCE(mistake_threshold, 6) FROM settings WHERE id = 1",
      [],
      |row| row.get(0),
    )
    .unwrap_or(6);
  let mut stmt = conn
    .prepare(
      "SELECT id, type, framework, title, prompt, content, reference_answer, difficulty, source, is_mistake, tags, common_errors, created_at FROM questions WHERE is_mistake = 1
       UNION
       SELECT q.id, q.type, q.framework, q.title, q.prompt, q.content, q.reference_answer, q.difficulty, q.source, q.is_mistake, q.tags, q.common_errors, q.created_at
       FROM questions q
       JOIN records r ON q.id = r.question_id
       WHERE r.overall_score < ?1
       GROUP BY q.id",
    )
    .map_err(|e| e.to_string())?;
  let questions = stmt
    .query_map([threshold], row_to_question)
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
  Ok(questions)
}

fn db_clear_all_data(conn: &mut Connection) -> Result<(), String> {
  let tx = conn.transaction().map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM records", []).map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM questions", [])
    .map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM principles", [])
    .map_err(|e| e.to_string())?;
  tx.execute("DELETE FROM settings", [])
    .map_err(|e| e.to_string())?;
  tx.execute("INSERT OR IGNORE INTO settings (id) VALUES (1)", [])
    .map_err(|e| e.to_string())?;
  tx.commit().map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn get_all_questions(
  state: tauri::State<'_, Mutex<Connection>>,
) -> Result<Vec<Question>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_all_questions(&conn)
}

#[tauri::command]
fn get_question_by_id(
  state: tauri::State<'_, Mutex<Connection>>,
  id: String,
) -> Result<Option<Question>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_question_by_id(&conn, &id)
}

#[tauri::command]
fn add_question(
  state: tauri::State<'_, Mutex<Connection>>,
  question: Question,
) -> Result<String, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_add_question(&conn, question)
}

#[tauri::command]
fn update_question(
  state: tauri::State<'_, Mutex<Connection>>,
  id: String,
  changes: serde_json::Value,
) -> Result<(), String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_update_question(&conn, &id, changes)
}

#[tauri::command]
fn delete_question(
  state: tauri::State<'_, Mutex<Connection>>,
  id: String,
) -> Result<(), String> {
  let mut conn = state.lock().map_err(|e| e.to_string())?;
  db_delete_question(&mut conn, &id)
}

#[tauri::command]
fn get_all_records(
  state: tauri::State<'_, Mutex<Connection>>,
) -> Result<Vec<PracticeRecord>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_all_records(&conn)
}

#[tauri::command]
fn get_record_by_id(
  state: tauri::State<'_, Mutex<Connection>>,
  id: String,
) -> Result<Option<PracticeRecord>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_record_by_id(&conn, &id)
}

#[tauri::command]
fn get_records_by_question_id(
  state: tauri::State<'_, Mutex<Connection>>,
  question_id: String,
) -> Result<Vec<PracticeRecord>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_records_by_question_id(&conn, &question_id)
}

#[tauri::command]
fn add_record(
  state: tauri::State<'_, Mutex<Connection>>,
  record: PracticeRecord,
) -> Result<String, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_add_record(&conn, record)
}

#[tauri::command]
fn update_record(
  state: tauri::State<'_, Mutex<Connection>>,
  id: String,
  changes: serde_json::Value,
) -> Result<(), String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_update_record(&conn, &id, changes)
}

#[tauri::command]
fn get_all_principles(
  state: tauri::State<'_, Mutex<Connection>>,
) -> Result<Vec<Principle>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_all_principles(&conn)
}

#[tauri::command]
fn get_principle_by_id(
  state: tauri::State<'_, Mutex<Connection>>,
  id: String,
) -> Result<Option<Principle>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_principle_by_id(&conn, &id)
}

#[tauri::command]
fn add_principle(
  state: tauri::State<'_, Mutex<Connection>>,
  principle: Principle,
) -> Result<String, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_add_principle(&conn, principle)
}

#[tauri::command]
fn update_principle(
  state: tauri::State<'_, Mutex<Connection>>,
  id: String,
  changes: serde_json::Value,
) -> Result<(), String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_update_principle(&conn, &id, changes)
}

#[tauri::command]
fn delete_principle(
  state: tauri::State<'_, Mutex<Connection>>,
  id: String,
) -> Result<(), String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_delete_principle(&conn, &id)
}

#[tauri::command]
fn get_settings(
  state: tauri::State<'_, Mutex<Connection>>,
) -> Result<Option<AppSettings>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_settings(&conn)
}

#[tauri::command]
fn update_settings(
  state: tauri::State<'_, Mutex<Connection>>,
  changes: serde_json::Value,
) -> Result<(), String> {
  let mut conn = state.lock().map_err(|e| e.to_string())?;
  db_update_settings(&mut conn, changes)
}

#[tauri::command]
fn get_mistake_questions(
  state: tauri::State<'_, Mutex<Connection>>,
) -> Result<Vec<Question>, String> {
  let conn = state.lock().map_err(|e| e.to_string())?;
  db_get_mistake_questions(&conn)
}

#[tauri::command]
fn clear_all_data(state: tauri::State<'_, Mutex<Connection>>) -> Result<(), String> {
  let mut conn = state.lock().map_err(|e| e.to_string())?;
  db_clear_all_data(&mut conn)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut context = tauri::generate_context!();
  let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
    .expect("failed to load icon");
  context.set_default_window_icon(Some(icon));

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let app_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("failed to get app local data dir: {}", e))?;
      std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("failed to create app local data dir: {}", e))?;
      let db_path = app_dir.join("temper.db");
      let conn = Connection::open(&db_path)
        .map_err(|e| format!("failed to open db: {}", e))?;
      init_db(&conn).map_err(|e| format!("failed to init db: {}", e))?;
      app.manage(Mutex::new(conn));
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_all_questions,
      get_question_by_id,
      add_question,
      update_question,
      delete_question,
      get_all_records,
      get_record_by_id,
      get_records_by_question_id,
      add_record,
      update_record,
      get_all_principles,
      get_principle_by_id,
      add_principle,
      update_principle,
      delete_principle,
      get_settings,
      update_settings,
      get_mistake_questions,
      clear_all_data,
    ])
    .run(context)
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    init_db(&conn).unwrap();
    conn
  }

  #[test]
  fn test_init_db_creates_tables() {
    let conn = setup_db();
    let mut stmt = conn
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .unwrap();
    let tables: Vec<String> = stmt
      .query_map([], |r| r.get(0))
      .unwrap()
      .collect::<Result<Vec<_>, _>>()
      .unwrap();
    assert!(tables.contains(&"questions".to_string()));
    assert!(tables.contains(&"records".to_string()));
    assert!(tables.contains(&"principles".to_string()));
    assert!(tables.contains(&"settings".to_string()));
  }

  #[test]
  fn test_settings_defaults() {
    let conn = setup_db();
    let settings = db_get_settings(&conn).unwrap().unwrap();
    assert_eq!(settings.id, 1);
    assert_eq!(settings.mistake_threshold, Some(6));
    assert_eq!(settings.practice_duration_seconds, Some(300));
    assert_eq!(settings.default_model, None);
    assert_eq!(settings.deepseek_api_key, None);
    assert_eq!(settings.deepseek_api_url, None);
    assert_eq!(settings.strict_sketch_mode, Some(false));
  }

  #[test]
  fn test_question_crud() {
    let conn = setup_db();
    let q = Question {
      id: "q1".to_string(),
      title: Some("Title".to_string()),
      prompt: Some("Prompt".to_string()),
      framework: "金字塔原理".to_string(),
      question_type: "诊断改错题".to_string(),
      tags: Some(vec!["tag1".to_string(), "tag2".to_string()]),
      difficulty: Some("中".to_string()),
      source: Some("手动录入".to_string()),
      reference_answer: Some("Answer".to_string()),
      common_errors: Some(vec!["err1".to_string()]),
      is_mistake: Some(0),
      content: Some("Content".to_string()),
      created_at: Some("2026-01-01T00:00:00Z".to_string()),
    };

    let id = db_add_question(&conn, q.clone()).unwrap();
    assert_eq!(id, "q1");

    let all = db_get_all_questions(&conn).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].title, Some("Title".to_string()));
    assert_eq!(all[0].tags, Some(vec!["tag1".to_string(), "tag2".to_string()]));

    let fetched = db_get_question_by_id(&conn, "q1").unwrap();
    assert!(fetched.is_some());

    db_update_question(
      &conn,
      "q1",
      serde_json::json!({"title": "Updated Title", "isMistake": 1}),
    )
    .unwrap();

    let updated = db_get_question_by_id(&conn, "q1").unwrap().unwrap();
    assert_eq!(updated.title, Some("Updated Title".to_string()));
    assert_eq!(updated.is_mistake, Some(1));

    let mut conn_mut = conn;
    db_delete_question(&mut conn_mut, "q1").unwrap();
    assert!(db_get_question_by_id(&conn_mut, "q1").unwrap().is_none());
  }

  #[test]
  fn test_record_crud_and_ordering() {
    let conn = setup_db();
    let q = Question {
      id: "q1".to_string(),
      question_type: "类型".to_string(),
      framework: "框架".to_string(),
      ..Default::default()
    };
    db_add_question(&conn, q).unwrap();

    let r1 = PracticeRecord {
      id: "r1".to_string(),
      question_id: "q1".to_string(),
      framework: "框架".to_string(),
      practiced_at: "2026-01-01T10:00:00Z".to_string(),
      overall_score: Some(7.5),
      attempt: Some(1),
      duration_seconds: Some(300),
      dimension_scores: Some(serde_json::json!({"结论先行": 7})),
      issue_list: Some(vec!["问题1".to_string()]),
      user_answer: Some("答案".to_string()),
      outline: Some("大纲".to_string()),
      ai_feedback: Some("反馈".to_string()),
      messages: Some(vec![Message {
        role: "user".to_string(),
        content: "hello".to_string(),
      }]),
      is_time_expired: Some(false),
      ..Default::default()
    };

    let r2 = PracticeRecord {
      id: "r2".to_string(),
      question_id: "q1".to_string(),
      framework: "框架".to_string(),
      practiced_at: "2026-01-01T08:00:00Z".to_string(),
      overall_score: Some(5.0),
      ..Default::default()
    };

    db_add_record(&conn, r1).unwrap();
    db_add_record(&conn, r2).unwrap();

    let all = db_get_all_records(&conn).unwrap();
    assert_eq!(all.len(), 2);

    let by_q = db_get_records_by_question_id(&conn, "q1").unwrap();
    assert_eq!(by_q.len(), 2);
    assert_eq!(by_q[0].id, "r2");
    assert_eq!(by_q[1].id, "r1");

    let fetched = db_get_record_by_id(&conn, "r1").unwrap().unwrap();
    assert_eq!(fetched.messages.as_ref().unwrap()[0].role, "user");

    db_update_record(
      &conn,
      "r1",
      serde_json::json!({"overallScore": 8.0, "issueList": ["问题2"]}),
    )
    .unwrap();
    let updated = db_get_record_by_id(&conn, "r1").unwrap().unwrap();
    assert_eq!(updated.overall_score, Some(8.0));
    assert_eq!(updated.issue_list, Some(vec!["问题2".to_string()]));
  }

  #[test]
  fn test_principle_crud() {
    let conn = setup_db();
    let p = Principle {
      id: "p1".to_string(),
      title: "原则1".to_string(),
      content: "内容".to_string(),
      tags: Some(vec!["汇报".to_string()]),
      created_at: Some("2026-01-01T00:00:00Z".to_string()),
      updated_at: Some("2026-01-01T00:00:00Z".to_string()),
    };

    db_add_principle(&conn, p.clone()).unwrap();
    let all = db_get_all_principles(&conn).unwrap();
    assert_eq!(all.len(), 1);

    db_update_principle(&conn, "p1", serde_json::json!({"title": "Updated"})).unwrap();
    let updated = db_get_principle_by_id(&conn, "p1").unwrap().unwrap();
    assert_eq!(updated.title, "Updated");

    db_delete_principle(&conn, "p1").unwrap();
    assert!(db_get_principle_by_id(&conn, "p1").unwrap().is_none());
  }

  #[test]
  fn test_update_settings_insert_default() {
    let mut conn = setup_db();
    db_update_settings(
      &mut conn,
      serde_json::json!({"mistakeThreshold": 8, "deepseekApiKey": "key123"}),
    )
    .unwrap();

    let settings = db_get_settings(&conn).unwrap().unwrap();
    assert_eq!(settings.mistake_threshold, Some(8));
    assert_eq!(settings.deepseek_api_key, Some("key123".to_string()));
    assert_eq!(settings.practice_duration_seconds, Some(300));
  }

  #[test]
  fn test_get_mistake_questions_logic() {
    let conn = setup_db();
    let q1 = Question {
      id: "q1".to_string(),
      question_type: "类型".to_string(),
      framework: "框架".to_string(),
      is_mistake: Some(1),
      ..Default::default()
    };
    let q2 = Question {
      id: "q2".to_string(),
      question_type: "类型".to_string(),
      framework: "框架".to_string(),
      is_mistake: Some(0),
      ..Default::default()
    };
    let q3 = Question {
      id: "q3".to_string(),
      question_type: "类型".to_string(),
      framework: "框架".to_string(),
      is_mistake: Some(0),
      ..Default::default()
    };
    db_add_question(&conn, q1).unwrap();
    db_add_question(&conn, q2).unwrap();
    db_add_question(&conn, q3).unwrap();

    let r1 = PracticeRecord {
      id: "r1".to_string(),
      question_id: "q2".to_string(),
      framework: "框架".to_string(),
      practiced_at: "2026-01-01T00:00:00Z".to_string(),
      overall_score: Some(4.0),
      ..Default::default()
    };
    let r2 = PracticeRecord {
      id: "r2".to_string(),
      question_id: "q3".to_string(),
      framework: "框架".to_string(),
      practiced_at: "2026-01-01T00:00:00Z".to_string(),
      overall_score: Some(7.0),
      ..Default::default()
    };
    db_add_record(&conn, r1).unwrap();
    db_add_record(&conn, r2).unwrap();

    let mistakes = db_get_mistake_questions(&conn).unwrap();
    assert_eq!(mistakes.len(), 2);
    let ids: Vec<String> = mistakes.iter().map(|q| q.id.clone()).collect();
    assert!(ids.contains(&"q1".to_string()));
    assert!(ids.contains(&"q2".to_string()));
    assert!(!ids.contains(&"q3".to_string()));
  }

  #[test]
  fn test_clear_all_data() {
    let mut conn = setup_db();
    let q = Question {
      id: "q1".to_string(),
      question_type: "类型".to_string(),
      framework: "框架".to_string(),
      ..Default::default()
    };
    db_add_question(&conn, q).unwrap();

    db_update_settings(&mut conn, serde_json::json!({"mistakeThreshold": 10})).unwrap();

    db_clear_all_data(&mut conn).unwrap();

    assert!(db_get_all_questions(&conn).unwrap().is_empty());
    assert!(db_get_all_records(&conn).unwrap().is_empty());
    assert!(db_get_all_principles(&conn).unwrap().is_empty());
    let settings = db_get_settings(&conn).unwrap().unwrap();
    assert_eq!(settings.mistake_threshold, Some(6));
  }
}
