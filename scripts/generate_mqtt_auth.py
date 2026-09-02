#!/usr/bin/env python3
"""Generate Mosquitto password and board-isolation ACL files.

The generated files are deployment artifacts and must stay outside version
control. Board passwords are read from the deployment-only users.toml file.
"""

from __future__ import annotations

import argparse
import getpass
import re
import subprocess
import tempfile
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10 deployments can use the project dependency.
    tomllib = None
if tomllib is None:
    import toml

BOARD_ID = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
WEAK = {"", "password", "changeme", "change_me", "board123", "admin"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", default="config/users.toml")
    parser.add_argument("--password-file", default="mosquitto/passwd")
    parser.add_argument("--acl-file", default="mosquitto/acl")
    parser.add_argument("--coreapi-password", default=None)
    args = parser.parse_args()

    with open(args.users, "rb") as config_file:
        users = (tomllib.load(config_file) if tomllib else toml.load(config_file))
    boards = users.get("boards", {})
    if not isinstance(boards, dict) or not boards:
        raise SystemExit("users.toml must define at least one board")
    credentials: list[tuple[str, str]] = []
    seen_passwords: set[str] = set()
    for board_id, config in boards.items():
        password = str((config or {}).get("password", "")).strip()
        if not BOARD_ID.fullmatch(str(board_id)):
            raise SystemExit(f"invalid board id: {board_id}")
        if len(password) < 16 or password.lower() in WEAK:
            raise SystemExit(f"board {board_id} needs a unique strong password")
        if password in seen_passwords:
            raise SystemExit("board passwords must be unique")
        seen_passwords.add(password)
        credentials.append((str(board_id), password))

    coreapi_password = args.coreapi_password or getpass.getpass("CoreAPI MQTT password: ")
    if len(coreapi_password) < 24 or coreapi_password.lower() in WEAK:
        raise SystemExit("CoreAPI MQTT password must be at least 24 characters")

    password_file = Path(args.password_file)
    acl_file = Path(args.acl_file)
    password_file.parent.mkdir(parents=True, exist_ok=True)
    acl_file.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=password_file.parent, prefix="passwd.", delete=False) as tmp:
        generated = Path(tmp.name)
    try:
        for index, (username, password) in enumerate([("coreapi", coreapi_password), *credentials]):
            command = ["mosquitto_passwd", "-b"]
            if index == 0:
                command.append("-c")
            command.extend([str(generated), username, password])
            subprocess.run(command, check=True, capture_output=True, text=True)
        generated.replace(password_file)
    finally:
        generated.unlink(missing_ok=True)

    lines = ["user coreapi", "topic readwrite enak/v3/#", ""]
    for board_id, _ in credentials:
        root = f"enak/v3/boards/{board_id}"
        lines.extend([
            f"user {board_id}",
            f"topic write {root}/telemetry",
            f"topic write {root}/events",
            f"topic write {root}/state-ack",
            f"topic write {root}/command-ack",
            f"topic write {root}/availability",
            "topic read enak/v3/server/availability",
            "topic read enak/v3/server/heartbeat",
            f"topic read {root}/state",
            f"topic read {root}/event-ack",
            f"topic read {root}/commands",
            f"topic read {root}/command-ack",
            "",
        ])
    acl_file.write_text("\n".join(lines), encoding="utf-8")
    password_file.chmod(0o600)
    acl_file.chmod(0o600)
    print(f"Generated {password_file} and {acl_file}; keep both deployment-only.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
