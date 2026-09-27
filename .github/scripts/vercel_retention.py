"""Prune one authorized Vercel project after deployment completion."""
import json
import os
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

TEAM = "team_DocP6tim1zcW7Pp7C1tMCUjS"
PROJECTS = {
    "matei-anghel/DystopiaBench": "prj_yOXkC71aRzOLCAp6IqYA7yWOrDXT",
    "matei-anghel/fintrix": "prj_uibdk1d2snq5QQkdi8D0LnPVlKzy",
    "matei-anghel/mawklabs": "prj_xcTVerA06Z9LJ67T5QA7Ovv6l1hL",
}
TERMINAL = {"READY", "ERROR", "CANCELED"}


def api(path, method="GET", **query):
    token = os.environ.get("VERCEL_RETENTION_TOKEN")
    if not token:
        raise RuntimeError("Add the VERCEL_RETENTION_TOKEN GitHub Actions secret to enable cleanup")
    url = "https://api.vercel.com" + path + "?" + urlencode({"teamId": TEAM, **query})
    request = Request(url, method=method, headers={"Authorization": "Bearer " + token})
    try:
        with urlopen(request, timeout=45) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except HTTPError as error:
        # Never log request headers or tokens.
        raise RuntimeError(f"Vercel {method} {path}: HTTP {error.code}") from None


def list_deployments(project_id):
    items, cursors = {}, set()
    cursor = None
    while True:
        query = {"projectId": project_id, "limit": 100}
        if cursor is not None:
            query["until"] = cursor
        page = api("/v7/deployments", **query)
        for item in page["deployments"]:
            items[item["uid"]] = item
        cursor = page.get("pagination", {}).get("next")
        if cursor is None:
            break
        if cursor in cursors:
            raise RuntimeError("Deployment pagination did not advance")
        cursors.add(cursor)
    return sorted(items.values(), key=lambda d: d["created"], reverse=True)


def select_keep(project, items):
    current = project.get("targets", {}).get("production", {})
    live = next((d for d in items if d["uid"] == current.get("id")), None)
    if current.get("readyState") != "READY" or not live or live.get("state") != "READY":
        raise RuntimeError("Cannot verify healthy live production; no deletions")
    if any(d.get("state") not in TERMINAL for d in items):
        return None  # A subsequent completion event will retry.
    if any(k not in {"production", "preview"} for k in project.get("targets", {})):
        raise RuntimeError("Custom environment requires review; no deletions")
    if any(d.get("target") == "production" and d.get("state") == "READY"
           and d["created"] > live["created"] for d in items):
        raise RuntimeError("Rollback or promotion in progress; no deletions")
    previous = [d for d in items if d["uid"] != live["uid"]
                and d.get("target") == "production" and d.get("state") == "READY"
                and d["created"] < live["created"]]
    # Keep up to three: never delete the only usable rollback versions.
    return {live["uid"], *(d["uid"] for d in previous[:2])}


def main():
    project_id = PROJECTS[os.environ["GITHUB_REPOSITORY"]]
    project = api("/v9/projects/" + project_id)
    if project.get("id") != project_id or project.get("accountId") != TEAM:
        raise RuntimeError("Unexpected project or team")
    items = list_deployments(project_id)
    keep = select_keep(project, items)
    if keep is None:
        print("Deployment in progress; waiting for its completion event")
        return
    live_id = project["targets"]["production"]["id"]
    doomed = [d for d in items if d["uid"] not in keep]
    print(json.dumps({"keep": sorted(keep), "remove": [d["uid"] for d in doomed]}))
    for deployment in doomed:
        fresh = api("/v9/projects/" + project_id)
        if fresh.get("targets", {}).get("production", {}).get("id") != live_id:
            raise RuntimeError("Live production changed; stopping cleanup")
        api("/v13/deployments/" + deployment["uid"], method="DELETE")
        print("Deleted " + deployment["uid"])
    remaining = list_deployments(project_id)
    ids = {d["uid"] for d in remaining}
    if not keep.issubset(ids):
        raise RuntimeError("A preserved deployment is missing; review immediately")
    if ids != keep:
        # A concurrent deployment might have arrived; do not delete outside the snapshot.
        raise RuntimeError("New deployment appeared during cleanup; next completion will retry")
    print(f"Verified {len(ids)} retained deployments; live production preserved")


if __name__ == "__main__":
    main()
