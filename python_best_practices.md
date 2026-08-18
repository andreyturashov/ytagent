# Python code best practices (insurance-quotes-engine)

Practical conventions for this codebase, with emphasis on modern syntax:
`match` / `case` and the walrus operator `:=`.

Prefer clarity over cleverness. Use new syntax when it removes duplication or
makes control flow easier to read — not because it is newer.

---

## General

- Prefer small, named helpers for mappings and payload builders over deep nests.
- Use early returns for guard clauses (`if not api_key: return ...`).
- Prefer dict lookups for multi-value maps with a default (e.g. coverage years).
- Keep type hints on public and non-trivial private methods.
- Do not catch bare `Exception` unless you log and convert to a safe return
  (partner HTTP / parse paths are the usual exception).

---

## Walrus operator (`:=`)

Assign and use a value in one expression. Best when you would otherwise
compute twice or introduce a throwaway name only for an `if`.

### Prefer

**Assign-and-test (truthy result):**

```python
if accidents := cls._build_accidents(data):
    driver["accidents"] = accidents

if shared := parsed.get("shared"):
    shared.ping_request = ping_request
```

**Reuse a stripped / normalized form:**

```python
if not phone or not (text := str(phone).strip()):
    return ""

digits = "".join(c for c in text if c.isdigit())
```

**Explicit `None` check after assign:**

```python
if (revenue := data.get("payout")) is None:
    revenue = buyers_revenue if status == "Success" else 0
```

### Avoid

- Packing long expressions into a walrus inside a comprehension or ternary
  until the line is hard to scan.
- Using `:=` only to “look modern” when a normal assignment is clearer:

```python
# Prefer this for multi-step work
user_agent = cls._resolved_user_agent(data.ua)
device_type = cls._device_type(user_agent)

# Not this
device_type = cls._device_type(user_agent := cls._resolved_user_agent(data.ua))
```

- Walrus in `_or_default`-style helpers when a simple ternary is already clear:

```python
return str(value).strip() if value and str(value).strip() else default
```

---

## Structural pattern matching (`match` / `case`)

Use `match` for **closed sets of values** (enums, known string tags). Prefer
plain `if` / `elif` for guards, substring heuristics, and multi-flag business
logic.

### Prefer — enum or fixed tag → result

```python
match gender:
    case GenderEnum.MALE:
        return "Male"
    case GenderEnum.FEMALE:
        return "Female"
    case GenderEnum.OTHER:
        return "Non-binary"
    case _:
        return ""

match buyer.get("type"):
    case "shared":
        shared_buyers.append(ping_buyer)
        shared_payout += float(bid)
    case "exclusive":
        exclusive_buyers.append(ping_buyer)
        exclusive_payout += float(bid)
    case _:
        pass
```

`case _:` is the exhaustive default. Keep it so new enum members fail closed
(empty / ignored) until handled deliberately.

### Prefer — dict map when many keys share one shape

When every branch is `key → constant`, a dict is often clearer than `match`:

```python
mapping = {
    ContinuousCoverageEnum.ZERO_TO_FIVE_MONTHS: 0,
    ContinuousCoverageEnum.SIX_MONTHS_TO_ONE_YEAR: 1,
    # ...
}
return mapping.get(continuous_coverage, DEFAULT)
```

### Avoid — substring / heuristic checks

```python
# Prefer if/elif
ua = user_agent.lower()
if "ipad" in ua or "tablet" in ua:
    return "Tablet"
if any(token in ua for token in MOBILE_TOKENS):
    return "Mobile"
return "Desktop"

# Avoid match with case _ if ... for this — it is not clearer
match ua := user_agent.lower():
    case _ if "ipad" in ua or "tablet" in ua:
        return "Tablet"
    ...
```

### Avoid — early-return guards

```python
# Prefer
if not self.api_key or not self.ping_url:
    return self._empty_ping_results()

# Do not wrap guard clauses in match
```

### Avoid — `match True` boolean ladders (usually)

```python
# Prefer if/elif for multi-flag status
if explicit_success or staging_success:
    status = "Success"
elif is_rejected:
    status = "Rejected"
else:
    status = "Failed"
```

`match True: case _ if ...` works but rarely reads better than `if` / `elif`.

---

## Choosing between `if`, `match`, and dict

| Situation | Prefer |
|---|---|
| Guard / early return | `if` |
| Enum or fixed string tags | `match` |
| Many keys → same-shaped values | `dict.get(..., default)` |
| Substring / UA / fuzzy checks | `if` / `elif` |
| Assign then test once | `:=` inside `if` |
| Multi-flag business status | `if` / `elif` |

---

## Examples from SmartFinancial client style

Patterns used in
`insurance_engine/auto_ad_insurances/clients/smart_financial_auto_ping_post.py`:

- Enum mappers (`_gender`, `_marital_status`, `_residence_own`, …) → `match`
- Optional builder results (`_build_accidents`, `_build_current_coverage`) → `:=`
- Attaching ping legs after parse → `if shared := parsed.get("shared"):`
- Buyer route type → `match buyer.get("type")`
- Device type from UA → plain `if` (heuristics)
- Coverage years → `dict` mapping

Keep new partner clients consistent with that split.
