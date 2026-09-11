import { ensureDatabase, runtime } from "./product-store";

const COOKIE_NAME = "ian_admin_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
// Cloudflare Workers Web Crypto supports PBKDF2 up to 100,000 iterations.
const PASSWORD_ITERATIONS = 100_000;

export type AdminIdentity = { id:number; username:string; sessionHash:string };

function bytesToBase64(bytes: Uint8Array) {
  let binary="";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
}

function base64ToBytes(value: string) {
  const normalized=value.replaceAll("-","+").replaceAll("_","/");
  const padded=normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary=atob(padded);
  return Uint8Array.from(binary,(character)=>character.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array) {
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({ name:"PBKDF2",hash:"SHA-256",salt,iterations:PASSWORD_ITERATIONS },material,256);
  return new Uint8Array(bits);
}

export async function createPassword(password: string) {
  if (password.length < 8) throw new Error("密碼至少需要 8 個字元");
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=await derivePassword(password,salt);
  return { passwordHash:bytesToBase64(hash),passwordSalt:bytesToBase64(salt) };
}

export async function verifyPassword(password: string, hashValue: string, saltValue: string) {
  const expected=base64ToBytes(hashValue);
  const actual=await derivePassword(password,base64ToBytes(saltValue));
  if (expected.length !== actual.length) return false;
  let mismatch=0;
  for (let index=0;index<expected.length;index++) mismatch |= expected[index] ^ actual[index];
  return mismatch === 0;
}

function readCookie(request: Request) {
  const cookies=request.headers.get("cookie") || "";
  for (const pair of cookies.split(";")) {
    const [name,...value]=pair.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(value.join("="));
  }
  return "";
}

async function hashSession(token: string) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return bytesToBase64(new Uint8Array(digest));
}

export async function createSession(userId: number) {
  const token=bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash=await hashSession(token);
  const now=new Date();
  const expires=new Date(now.getTime() + SESSION_SECONDS * 1000);
  await runtime.DB.prepare("INSERT INTO admin_sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)")
    .bind(tokenHash,userId,expires.toISOString(),now.toISOString()).run();
  return { token,tokenHash,expires };
}

export function sessionCookie(token: string, maxAge=SESSION_SECONDS) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function getAdmin(request: Request): Promise<AdminIdentity|null> {
  await ensureDatabase();
  const token=readCookie(request);
  if (!token) return null;
  const sessionHash=await hashSession(token);
  const row=await runtime.DB.prepare(`SELECT u.id,u.username FROM admin_sessions s
    JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`)
    .bind(sessionHash,new Date().toISOString()).first();
  return row ? { id:Number(row.id),username:String(row.username),sessionHash } : null;
}

export async function requireAdmin(request: Request) {
  return getAdmin(request);
}

export function unauthorized() {
  return Response.json({ error:"請先登入管理後台" },{ status:401 });
}

export function normalizeUsername(value: unknown) {
  const username=String(value || "").trim().toLowerCase();
  if (username.length < 3) throw new Error("帳號至少需要 3 個字元");
  if (!/^[a-z0-9._-]+$/.test(username)) throw new Error("帳號僅能使用英文字母、數字、點、底線或連字號");
  return username;
}
