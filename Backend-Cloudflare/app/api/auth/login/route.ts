import { createSession, normalizeUsername, sessionCookie, verifyPassword } from "../../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../../lib/product-store";

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload=await request.json() as { username?:string;password?:string };
    const username=normalizeUsername(payload.username);
    const row=await runtime.DB.prepare("SELECT id,username,password_hash,password_salt FROM admin_users WHERE username=?").bind(username).first();
    const valid=row && await verifyPassword(String(payload.password || ""),String(row.password_hash),String(row.password_salt));
    if (!row || !valid) return Response.json({ error:"帳號或密碼不正確" },{ status:401 });
    const session=await createSession(Number(row.id));
    return Response.json({ user:{ id:Number(row.id),username:String(row.username) } },{ headers:{ "set-cookie":sessionCookie(session.token) } });
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : "登入失敗" },{ status:400 });
  }
}
