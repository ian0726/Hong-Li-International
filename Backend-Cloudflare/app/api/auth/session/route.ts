import { ensureDatabase, runtime } from "../../../../lib/product-store";
import { getAdmin } from "../../../../lib/admin-auth";

export async function GET(request: Request) {
  await ensureDatabase();
  const total=await runtime.DB.prepare("SELECT COUNT(*) AS total FROM admin_users").first();
  const user=await getAdmin(request);
  return Response.json({ setupRequired:Number(total?.total || 0) === 0,authenticated:Boolean(user),user:user ? { id:user.id,username:user.username } : null });
}
