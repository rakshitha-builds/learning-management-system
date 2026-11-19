export type Role = "OWNER" | "EDITOR" | "COMMENTER" | "VIEWER";
export const ROLE_RANK: Record<Role, number> = { VIEWER: 1, COMMENTER: 2, EDITOR: 3, OWNER: 4 };
export const hasRole = (role: Role | undefined, min: Role) => !!role && ROLE_RANK[role] >= ROLE_RANK[min];
export const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", EDITOR: "Can edit", COMMENTER: "Can comment", VIEWER: "Can view" };

export interface User { id: string; email: string; name: string; color: string; bio: string | null; createdAt: string }
export interface WorkspaceSummary { id: string; name: string; description: string | null; icon: string; role: Role; memberCount: number; documentCount: number; updatedAt: string }
export interface Member { userId: string; name: string; email: string; color: string; role: Role; joinedAt: string }
export interface Invite { id: string; email: string; role: Role; createdAt: string }
export interface DocSummary { id: string; title: string; icon: string; preview: string; createdAt: string; updatedAt: string; createdBy: { id: string; name: string } }
export interface DocDetail { id: string; title: string; icon: string; workspaceId: string; role: Role; updatedAt: string; workspace: { id: string; name: string; icon: string } }
export interface Author { id: string; name: string; color: string }
export interface CommentT { id: string; body: string; quote: string | null; resolved: boolean; createdAt: string; author: Author; replies?: CommentT[] }
export interface VersionT { id: string; label: string | null; title: string; auto: boolean; createdAt: string; createdBy: Author | null }
export interface PermissionRow { userId: string; name: string; email: string; color: string; workspaceRole: Role; override: Role | null; effectiveRole: Role }
