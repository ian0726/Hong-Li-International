import { getAdmin, sessionCookie } from "../../../../lib/admin-auth";
import { runtime } from "../../../../lib/product-store";

export async function POST(request: Request) {
  const admin=await getAdmin(request);
  if (admin) await runtime.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(admin.sessionHash).run();
  return Response.json({ ok:true },{ headers:{ "set-cookie":sessionCookie("",0) } });
}
