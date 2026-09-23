/**
 * Google Drive integration boundary.
 *
 * This foundation does NOT connect to Drive yet.
 * Future implementation must:
 * - authenticate with OAuth
 * - store one authorized root folder ID
 * - reject items outside that root
 * - use file IDs as identity
 * - treat folder contents as dynamic
 * - separate read/write/destructive permissions
 * - require explicit owner authorization for writes where applicable
 */

export interface DriveProvider {
  listChildren(folderId: string): Promise<unknown[]>;
  readFile(fileId: string): Promise<unknown>;
  createFile(parentFolderId: string, metadata: Record<string, unknown>, content?: Uint8Array): Promise<unknown>;
  updateFile(fileId: string, changes: Record<string, unknown>): Promise<unknown>;
}

export function assertInsideAuthorizedRoot(
  authorizedRootId: string,
  parentIds: string[]
): void {
  if (!parentIds.includes(authorizedRootId)) {
    throw new Error("Drive access denied: item is outside the authorized root.");
  }
}
