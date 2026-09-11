import { createPassword, normalizeUsername, requireAdmin, unauthorized } from "../../../../lib/admin-auth";
import { runtime } from "../../../../lib/product-store";

function mapUser(row: Record<string,unknown>) {
  return { id:Number(row.id),username:String(row.username),createdAt:String(row.created_at),updatedAt:String(row.updated_at) };
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return unauthorized();
  const result=await runtime.DB.prepare("SELECT id,username,created_at,updated_at FROM admin_users ORDER BY id ASC").all();
  return Response.json({ users:result.results.map(mapUser) });
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) return unauthorized();
    const payload=await request.json() as { username?:string;password?:string };
    const username=normalizeUsername(payload.username);
    const credentials=await createPassword(String(payload.password || ""));
    const now=new Date().toISOString();
    await runtime.DB.prepare("INSERT INTO admin_users (username,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?)")
      .bind(username,credentials.passwordHash,credentials.passwordSalt,now,now).run();
    const row=await runtime.DB.prepare("SELECT id,username,created_at,updated_at FROM admin_users WHERE username=?").bind(username).first();
    return Response.json({ user:mapUser(row || {}) },{ status:201 });
  } catch (error) {
    const message=error instanceof Error ? error.message : "新增帳號失敗";
    return Response.json({ error:message.includes("UNIQUE") ? "此帳號已存在" : message },{ status:400 });
  }
}
