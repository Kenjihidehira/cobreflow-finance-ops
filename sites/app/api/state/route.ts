import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import seed from "@/data/seed.json";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { applyAction, buildDashboard, cloneSeed, normalizeState } from "@/lib/domain.js";

const seedState = cloneSeed(seed);
const returnTo = "/demo/index.html";

async function loadState(userEmail: string | null) {
  if (!userEmail) return cloneSeed(seed);
  const [workspace] = await (await getDb())
    .select({ stateJson: workspaces.stateJson })
    .from(workspaces)
    .where(eq(workspaces.userEmail, userEmail))
    .limit(1);
  if (!workspace) return cloneSeed(seed);
  try {
    return normalizeState(JSON.parse(workspace.stateJson), seedState);
  } catch {
    return cloneSeed(seed);
  }
}

function sessionPayload(user: Awaited<ReturnType<typeof getChatGPTUser>>) {
  return user
    ? { authenticated: true, displayName: user.displayName, canWrite: true, signOutUrl: chatGPTSignOutPath(returnTo) }
    : { authenticated: false, displayName: null, canWrite: false, signInUrl: chatGPTSignInPath(returnTo) };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const state = await loadState(user?.email ?? null);
  return NextResponse.json({
    ...buildDashboard(state, new URL(request.url).searchParams),
    session: sessionPayload(user),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json(
      { error: "Entre com o ChatGPT para salvar alteracoes.", signInUrl: chatGPTSignInPath(returnTo) },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON invalido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("action" in body) || typeof body.action !== "string") {
    return NextResponse.json({ error: "Acao invalida." }, { status: 400 });
  }

  try {
    const next = applyAction(await loadState(user.email), body);
    const now = new Date().toISOString();
    await (await getDb())
      .insert(workspaces)
      .values({ userEmail: user.email, stateJson: JSON.stringify(next), createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: workspaces.userEmail,
        set: { stateJson: JSON.stringify(next), updatedAt: now },
      });
    return NextResponse.json({ ...buildDashboard(next, new URLSearchParams()), session: sessionPayload(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar o workspace.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
