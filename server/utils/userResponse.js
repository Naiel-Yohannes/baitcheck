export function toUserResponse(userDoc, org) {
  const rawId = userDoc?._id ?? userDoc?.id
  const rawOrgId = userDoc?.orgId?._id ?? userDoc?.orgId

  return {
    id: rawId?.toString?.() ?? String(rawId ?? ''),
    name: userDoc.name,
    email: userDoc.email,
    role: userDoc.role,
    orgId: rawOrgId == null ? null : (rawOrgId.toString?.() ?? String(rawOrgId)),
    orgName: org?.name ?? null,
  }
}
