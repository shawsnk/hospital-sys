import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// POST /api/auth — 登录（邮箱 + 密码 SHA-256）
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const { email, password } = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Demo mode: try exact match first, then fallback to default super_admin
    // Hash password with SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, name, role, avatar_letter, avatar_class, is_active")
      .eq("email", email)
      .eq("password_hash", passwordHash)
      .single();

    // If exact match found, use it
    if (user && user.is_active) {
      const token = btoa(JSON.stringify({ id: user.id, ts: Date.now() }));
      return NextResponse.json({ user, token });
    }

    // Demo fallback: any email/password → login as super_admin for demo purposes
    const { data: fallback } = await supabase
      .from("users")
      .select("id, email, name, role, avatar_letter, avatar_class, is_active")
      .eq("role", "super_admin")
      .limit(1)
      .single();

    if (!fallback) {
      return NextResponse.json({ error: "系统无可用账号" }, { status: 500 });
    }

    const token = btoa(JSON.stringify({ id: fallback.id, ts: Date.now() }));
    return NextResponse.json({ user: fallback, token });
  } catch (err) {
    console.error("POST /api/auth error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth — 用 token 获取当前用户信息
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    let payload: { id: string };
    try {
      payload = JSON.parse(atob(token));
    } catch {
      return NextResponse.json({ error: "无效 token" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, name, role, avatar_letter, avatar_class, is_active")
      .eq("id", payload.id)
      .single();

    if (error || !user || !user.is_active) {
      return NextResponse.json({ error: "用户不存在或已停用" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /api/auth error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
