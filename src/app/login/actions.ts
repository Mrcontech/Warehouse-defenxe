"use server";

import { redirect } from "next/navigation";
import { isConnectionError, isMissingTable, query, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { startSession } from "@/lib/session";

export type LoginState = { error?: string; username?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password.", username };
  let admin: { admin_id: number; full_name: string; password_hash: string } | null;
  try {
    admin = await queryOne("SELECT admin_id, full_name, password_hash FROM app_admin WHERE username = ?", [username]);
  } catch (e) {
    if (isConnectionError(e)) return { error: "Cannot reach MySQL. Start it in the XAMPP Control Panel, then try again.", username };
    if (isMissingTable(e)) return { error: "The warehouse is not set up yet. Run npm start once to create it.", username };
    throw e;
  }
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return { error: "That username and password do not match.", username };
  }
  await query("UPDATE app_admin SET last_login_at = NOW() WHERE admin_id = ?", [admin.admin_id]);
  await startSession(username, admin.full_name);
  redirect("/dashboard");
}
