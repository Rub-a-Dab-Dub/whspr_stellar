function normalizeRoleSource(memberInfo: unknown): unknown {
  if (memberInfo == null) {
    return null;
  }
  if (Array.isArray(memberInfo) && memberInfo.length >= 2) {
    return memberInfo[1];
  }
  if (typeof memberInfo === 'object' && memberInfo !== null && 'role' in memberInfo) {
    return (memberInfo as Record<string, unknown>).role;
  }
  return null;
}

export function isGroupAdminOrModerator(memberInfo: unknown): boolean {
  const role = normalizeRoleSource(memberInfo);
  if (role == null) {
    return false;
  }

  if (typeof role === 'string') {
    const s = role.toLowerCase();
    return s === 'admin' || s === 'moderator';
  }

  if (typeof role === 'object' && role !== null) {
    const o = role as Record<string, unknown>;
    if ('Admin' in o || 'Moderator' in o) {
      return true;
    }
    const tag = o.tag;
    if (typeof tag === 'string') {
      const t = tag.toLowerCase();
      return t === 'admin' || t === 'moderator';
    }
  }

  return false;
}
