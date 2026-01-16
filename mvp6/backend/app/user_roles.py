USER_ROLE_ALIASES = {
    "viewer": "view",
    "editor": "edit",
}

USER_ROLES = {"view", "edit", "admin", "super_admin"}


def normalize_user_role(role: str | None) -> str:
    if not role:
        return "view"
    return USER_ROLE_ALIASES.get(role, role)
