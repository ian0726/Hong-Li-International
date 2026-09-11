import { createPassword, normalizeUsername, requireAdmin, unauthorized } from "../../../../../lib/admin-auth";
import { runtime } from "../../../../../lib/product-store";

export async function PATCH(request: Request,{ params }:{ params:Promise<{ id:string }> }) {
  try {
    const admin=await requireAdmin(request);
    if (!admin) return unauthorized();
    const { id }=await params;
    const userId=Number(id);
    const current=await runtime.DB.prepare("SELECT id,username FROM admin_users WHERE id=?").bind(userId).first();
    if (!current) return Response.json({ error:"找不到帳號" },{ status:404 });
    const payload=await request.json() as { username?:string;password?:string };
    const username=normalizeUsername(payload.username ?? current.username);
    const password=String(payload.password || "");
    const now=new Date().toISOString();
    if (password) {
      const credentials=await createPassword(password);
      await runtime.DB.batch([
        runtime.DB.prepare("UPDATE admin_users SET username=?,password_hash=?,password_salt=?,updated_at=? WHERE id=?")
          .bind(username,credentials.passwordHash,credentials.passwordSalt,now,userId),
        runtime.DB.prepare("DELETE FROM admin_sessions WHERE user_id=?").bind(userId),
      ]);
    } else {
      await runtime.DB.prepare("UPDATE admin_users SET username=?,updated_at=? WHERE id=?").bind(username,now,userId).run();
    }
    return Response.json({ user:{ id:userId,username },forceLogout:password && admin.id === userId });
  } catch (error) {
    const message=error instanceof Error ? error.message : "更新帳號失敗";
    return Response.json({ error:message.includes("UNIQUE") ? "此帳號已存在" : message },{ status:400 });
  }
}

export async function DELETE(request: Request,{ params }:{ params:Promise<{ id:string }> }) {
  const admin=await requireAdmin(request);
  if (!admin) return unauthorized();
  const { id }=await params;
  const userId=Number(id);
  if (admin.id === userId) return Response.json({ error:"不能刪除目前登入中的帳號" },{ status:409 });
  const total=await runtime.DB.prepare("SELECT COUNT(*) AS total FROM admin_users").first();
  if (Number(total?.total || 0) <= 1) return Response.json({ error:"至少需要保留一個管理員帳號" },{ status:409 });
  await runtime.DB.batch([
    runtime.DB.prepare("DELETE FROM admin_sessions WHERE user_id=?").bind(userId),
    runtime.DB.prepare("DELETE FROM admin_users WHERE id=?").bind(userId),
  ]);
  return Response.json({ ok:true });
}
