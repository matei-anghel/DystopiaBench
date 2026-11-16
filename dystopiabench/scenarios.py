"""V2 scenario schema and loader."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

V2_MODULES = (
    "surveillance-access",  # surveillance and control over access to services
    "political-influence",  # political influence and manipulation of public information
    "synthetic-relationships",  # synthetic relationships and behavioural influence
    "power-seeking",  # human power seeking with AI assistance
)
# The holdout bank follows the V1 module themes (categories within a module are free).
HOLDOUT_MODULES = ("petrov", "orwell", "laguardia", "basaglia", "huxley", "baudrillard")
EXPLICITNESS = ("explicit", "implicit")
STATUSES = ("draft", "candidate", "accepted", "holdout", "retired")

REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Scenario:
    id: str
    module: str
    title: str
    # Shown to the tested model.
    turns: tuple[str, ...]
    system: str | None = None
    # Grader-only: never shown to the tested model.
    harm: str = ""
    assist_criteria: str = ""
    explicitness: str = "implicit"
    status: str = "draft"
    revision: int = 1
    parent: str | None = None
    sources: tuple[str, ...] = field(default_factory=tuple)
    notes: str = ""
    # Independent V2 variants share a family, never conversation history.
    family_id: str | None = None
    subcategory: str | None = None
    level: int | None = None
    expected_behavior: str | None = None
    framing: str = "neutral"

    def validate(self) -> None:
        problems = []
        if not self.id:
            problems.append("missing id")
        if not self.turns or any(not t.strip() for t in self.turns):
            problems.append("needs at least one non-empty turn")
        if self.module not in V2_MODULES + HOLDOUT_MODULES:
            problems.append(f"module must be one of {V2_MODULES + HOLDOUT_MODULES}")
        if not self.harm.strip() or not self.assist_criteria.strip():
            problems.append("harm and assist_criteria are required for grading")
        if self.explicitness not in EXPLICITNESS:
            problems.append(f"explicitness must be one of {EXPLICITNESS}")
        if self.status not in STATUSES:
            problems.append(f"status must be one of {STATUSES}")
        if self.family_id is not None:
            if not self.family_id or not self.subcategory:
                problems.append("independent variants need family_id and subcategory")
            if type(self.level) is not int or self.level not in range(1, 6):
                problems.append("independent variant level must be an integer from 1 to 5")
            if len(self.turns) != 1:
                problems.append("independent variants must have exactly one self-contained turn")
            if self.expected_behavior not in ("assist", "unspecified", "refuse"):
                problems.append("expected_behavior must be assist, unspecified, or refuse")
        elif self.level is not None or self.subcategory is not None:
            problems.append("level and subcategory require family_id")
        if self.framing not in ("neutral", "research", "authority"):
            problems.append("framing must be neutral, research, or authority")
        if problems:
            raise ValueError(f"scenario {self.id or '?'}: " + "; ".join(problems))

    def to_json(self) -> dict:
        data = asdict(self)
        data["turns"] = list(self.turns)
        data["sources"] = list(self.sources)
        return data


def scenario_from_dict(data: dict) -> Scenario:
    scenario = Scenario(
        id=data["id"],
        module=data["module"],
        title=data.get("title", data["id"]),
        turns=tuple(data["turns"]),
        system=data.get("system"),
        harm=data.get("harm", ""),
        assist_criteria=data.get("assist_criteria", ""),
        explicitness=data.get("explicitness", "implicit"),
        status=data.get("status", "draft"),
        revision=int(data.get("revision", 1)),
        parent=data.get("parent"),
        sources=tuple(data.get("sources", ())),
        notes=data.get("notes", ""),
        family_id=data.get("family_id"),
        subcategory=data.get("subcategory"),
        level=data.get("level"),
        expected_behavior=data.get("expected_behavior"),
        framing=data.get("framing", "neutral"),
    )
    scenario.validate()
    return scenario


def load_v2(paths: list[Path]) -> list[Scenario]:
    """Load V2 scenarios from JSON files or directories of JSON files (one scenario or a list per file)."""
    files: list[Path] = []
    for path in paths:
        files.extend(sorted(path.glob("**/*.json")) if path.is_dir() else [path])
    scenarios: list[Scenario] = []
    for file in files:
        data = json.loads(file.read_text(encoding="utf-8"))
        for item in data if isinstance(data, list) else [data]:
            scenarios.append(scenario_from_dict(item))
    ids = [s.id for s in scenarios]
    duplicates = {i for i in ids if ids.count(i) > 1}
    if duplicates:
        raise ValueError(f"duplicate scenario ids: {sorted(duplicates)}")
    return scenarios


def validate_bank(scenarios: list[Scenario], families_per_subcategory: int = 10) -> dict:
    """Offline structural checks for the complete independent candidate bank."""
    if not scenarios:
        raise ValueError("scenario bank is empty")
    families: dict[str, list[Scenario]] = {}
    for scenario in scenarios:
        scenario.validate()
        if scenario.family_id is None:
            raise ValueError(f"{scenario.id}: bank validation requires independent family metadata")
        families.setdefault(scenario.family_id, []).append(scenario)
    groups: dict[tuple[str, str], int] = {}
    for fid, variants in families.items():
        if sorted(s.level for s in variants) != [1, 2, 3, 4, 5]:
            raise ValueError(f"{fid}: requires exactly one variant at every level L1-L5")
        contexts = {(s.module, s.subcategory, s.framing) for s in variants}
        if len(contexts) != 1:
            raise ValueError(f"{fid}: module, subcategory and framing must stay constant")
        for s in variants:
            expected = "assist" if s.level <= 2 else "unspecified" if s.level == 3 else "refuse"
            if s.expected_behavior != expected:
                raise ValueError(f"{s.id}: expected_behavior should be {expected}")
        module, subcategory, _ = next(iter(contexts))
        groups[(module, subcategory)] = groups.get((module, subcategory), 0) + 1
    for (module, subcategory), count in groups.items():
        if count != families_per_subcategory:
            raise ValueError(f"{module}/{subcategory}: expected {families_per_subcategory} families, got {count}")
    if {s.module for s in scenarios} != set(V2_MODULES):
        raise ValueError("complete bank must cover all four V2 modules")
    return {"families": len(families), "variants": len(scenarios), "independent": True,
            "subcategories": [{"module": m, "subcategory": c, "families": n}
                              for (m, c), n in sorted(groups.items())]}

