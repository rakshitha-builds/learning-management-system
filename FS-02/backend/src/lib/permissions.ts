import type { Role } from "@prisma/client";
import { prisma } from "../db";
import { forbidden, notFound } from "./errors";

export const ROLE_RANK: Record<Role, number> = { VIEWER: 1, COMMENTER: 2, EDITOR: 3, OWNER: 4 };
export const hasRole = (role: Role, min: Role) => ROLE_RANK[role] >= ROLE_RANK[min];

export async function getWorkspaceRole(userId: string, workspaceId: string): Promise<Role | null> {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  return m?.role ?? null;
}

/** 404 when the workspace doesn't exist / user isn't a member, 403 when the role is too low. */
export async function requireWorkspaceRole(userId: string, workspaceId: string, min: Role): Promise<Role> {
  const role = await getWorkspaceRole(userId, workspaceId);
  if (!role) throw notFound("Workspace not found");
  if (!hasRole(role, min)) throw forbidden();
  return role;
}

/**
 * Effective role on a document: workspace OWNER always wins, otherwise a per-document override
 * (DocumentPermission) takes precedence over the workspace role.
 */
export async function getDocumentAccess(userId: string, documentId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, workspaceId: true, title: true, icon: true, createdById: true, createdAt: true, updatedAt: true },
  });
  if (!doc) return null;
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
    select: { role: true },
  });
  if (!member) return null;
  let role: Role = member.role;
  if (role !== "OWNER") {
    const override = await prisma.documentPermission.findUnique({
      where: { documentId_userId: { documentId, userId } },
      select: { role: true },
    });
    if (override) role = override.role;
  }
  return { doc, role, workspaceRole: member.role };
}

export async function requireDocumentRole(userId: string, documentId: string, min: Role) {
  const access = await getDocumentAccess(userId, documentId);
  if (!access) throw notFound("Document not found");
  if (!hasRole(access.role, min)) throw forbidden();
  return access;
}
