import { invoke } from "@tauri-apps/api/core";
import type { Question, PracticeRecord, AppSettings, Principle } from "../types";

export class TemperDB {
  // Questions
  async getAllQuestions(): Promise<Question[]> {
    return invoke("get_all_questions");
  }

  async getQuestionById(id: string): Promise<Question | undefined> {
    return invoke("get_question_by_id", { id });
  }

  async addQuestion(q: Question): Promise<string> {
    await invoke("add_question", { question: q });
    return q.id;
  }

  async updateQuestion(
    id: string,
    changes: Partial<Omit<Question, "id">>
  ): Promise<void> {
    await invoke("update_question", { id, changes });
  }

  async deleteQuestion(id: string): Promise<void> {
    await invoke("delete_question", { id });
  }

  // Records
  async getAllRecords(): Promise<PracticeRecord[]> {
    return invoke("get_all_records");
  }

  async getRecordById(id: string): Promise<PracticeRecord | undefined> {
    return invoke("get_record_by_id", { id });
  }

  async getRecordsByQuestionId(questionId: string): Promise<PracticeRecord[]> {
    return invoke("get_records_by_question_id", { questionId });
  }

  async addRecord(r: PracticeRecord): Promise<string> {
    await invoke("add_record", { record: r });
    return r.id;
  }

  async updateRecord(
    id: string,
    changes: Partial<Omit<PracticeRecord, "id">>
  ): Promise<void> {
    await invoke("update_record", { id, changes });
  }

  // Principles
  async getAllPrinciples(): Promise<Principle[]> {
    return invoke("get_all_principles");
  }

  async getPrincipleById(id: string): Promise<Principle | undefined> {
    return invoke("get_principle_by_id", { id });
  }

  async addPrinciple(p: Principle): Promise<string> {
    await invoke("add_principle", { principle: p });
    return p.id;
  }

  async updatePrinciple(
    id: string,
    changes: Partial<Omit<Principle, "id">>
  ): Promise<void> {
    await invoke("update_principle", { id, changes });
  }

  async deletePrinciple(id: string): Promise<void> {
    await invoke("delete_principle", { id });
  }

  // Mistakes
  async getMistakeQuestions(): Promise<Question[]> {
    return invoke("get_mistake_questions");
  }

  // Settings
  async getSettings(): Promise<AppSettings | undefined> {
    return invoke("get_settings");
  }

  async updateSettings(
    changes: Partial<Omit<AppSettings, "id">>
  ): Promise<void> {
    await invoke("update_settings", { changes });
  }

  // Clear all data
  async clearAllData(): Promise<void> {
    await invoke("clear_all_data");
  }
}

export const db = new TemperDB();
