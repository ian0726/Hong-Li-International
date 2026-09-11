import { createPassword, createSession, normalizeUsername, sessionCookie } from "../../../../lib/admin-auth";
import { ensureDatabase, runtime } from "../../../../lib/product-store";

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const total=await runtime.DB.prepare("SELECT COUNT(*) AS total FROM admin_users").first();
    if (Number(total?.total || 0) > 0) return Response.json({ error:"管理員已建立，請直接登入" },{ status:409 });
    const payload=await request.json() as { username?:string;password?:string };
    const username=normalizeUsername(payload.username);
    const password=String(payload.password || "");
    const credentials=await createPassword(password);
    const now=new Date().toISOString();
    await runtime.DB.prepare("INSERT INTO admin_users (username,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?)")
      .bind(username,credentials.passwordHash,credentials.passwordSalt,now,now).run();
    const user=await runtime.DB.prepare("SELECT id,username FROM admin_users WHERE username=?").bind(username).first();
    if (!user) throw new Error("管理員建立失敗");
    const session=await createSession(Number(user.id));
    return Response.json({ user:{ id:Number(user.id),username:String(user.username) } },{ status:201,headers:{ "set-cookie":sessionCookie(session.token) } });
  } catch (error) {
    const message=error instanceof Error ? error.message : "建立管理員失敗";
    return Response.json({ error:message.includes("UNIQUE") ? "此帳號已存在" : message },{ status:400 });
  }
}
