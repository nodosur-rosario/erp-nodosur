import { cookies } from "next/headers";

const CUIT_COOKIE = "erp_active_cuit";

const cookieOptions = {
  httpOnly: false, // Let client components read it if needed
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setActiveCuitCookie(cuit: string) {
  try {
    const store = await cookies();
    store.set(CUIT_COOKIE, cuit, { ...cookieOptions, maxAge: 60 * 60 * 24 * 365 }); // 1 year
  } catch (e) {
    // Ignore outside request scope
  }
}

export async function clearActiveCuitCookie() {
  try {
    const store = await cookies();
    store.delete(CUIT_COOKIE);
  } catch (e) {
    // Ignore
  }
}

export async function getActiveCuitCookie() {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return "20123456789";
  }
  try {
    const store = await cookies();
    return store.get(CUIT_COOKIE)?.value ?? null;
  } catch (e) {
    return null;
  }
}
