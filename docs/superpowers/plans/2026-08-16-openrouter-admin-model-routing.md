# OpenRouter Admin Configuration and Model Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure superadmin management of one platform OpenRouter key and authoritative scenario-based model routing with bounded fallback and SafetyGate retry behavior.

**Architecture:** Persist one optional encrypted OpenRouter configuration row, resolve it ahead of the environment bootstrap, and expose only safe superadmin contracts. Extend the existing provider with authenticated key/catalog reads, then route AI draft generation through a two-attempt executor selected by message type, rating and SafetyGate result. Add a dedicated `/app/admin/llm` operational page using existing UI tokens and backend-authoritative RBAC.

**Tech Stack:** Python 3.13, FastAPI, Pydantic 2, SQLAlchemy 2 async, Alembic, httpx `MockTransport`, PostgreSQL, Next.js 16, React 19, TypeScript 5.9, Zod 4, TanStack Query 5, Vitest, Playwright.

## Global Constraints

- Work only on `codex/0.1.104-backend`; do not create a branch or worktree.
- Keep the existing draft PR; do not merge, deploy, tag or bump version `0.1.103`.
- Use one platform-wide OpenRouter inference key; do not add organization BYOK or management-key behavior.
- Do not add dependencies or visual tokens.
- Use only existing `CredentialService` encryption and project design tokens.
- Never return, log, audit, persist in evidence or render a raw/decrypted key or provider response body.
- Backend `require_superadmin` is authoritative and must run before decryption or network access.
- Use official `GET /key`, `GET /models/user` and existing `POST /chat/completions` contracts.
- Use synthetic transports only; do not call live OpenRouter or marketplace APIs.
- A draft generation makes at most two provider completion calls.
- Run focused checks during tasks and one full affected-package gate at the end.

## File map

### Backend persistence and contracts

- Create `apps/api/alembic/versions/20260816_0018_llm_provider_settings.py` — table, all-or-none route constraint and foreign key.
- Create `apps/api/app/models/llm_provider_setting.py` — ORM mapping only.
- Modify `apps/api/app/models/__init__.py` — model registration.
- Modify `scripts/check_integrity.py` — expected single Alembic head.
- Create `apps/api/app/schemas/llm_admin.py` — safe admin request/response schemas and route ids.

### Backend provider, configuration and generation

- Modify `apps/api/app/providers/openrouter.py` — injectable transport, key metadata and user-model catalog operations.
- Create `apps/api/app/services/llm_configuration_service.py` — encrypted persistence, source precedence, catalog normalization, route validation and audit.
- Create `apps/api/app/services/llm_route_resolver.py` — pure route selection and runtime configuration types.
- Create `apps/api/app/api/admin_llm.py` — superadmin HTTP endpoints.
- Modify `apps/api/app/main.py` — register the admin LLM router and allow `PUT` in CORS.
- Modify `apps/api/app/services/ai_service.py` — use runtime configuration and bounded attempt policy.
- Modify `apps/api/app/schemas/ai.py` — remove arbitrary client model selection.
- Modify `apps/api/app/api/ai.py` — stop forwarding a model override.

### Backend tests

- Create `apps/api/app/tests/test_llm_provider_settings_contract.py` — model, schema, migration and resolver invariants.
- Expand `apps/api/app/tests/test_openrouter_provider.py` — `/key`, `/models/user`, filtering and safe failures.
- Create `apps/api/app/tests/test_llm_configuration_service.py` — precedence, encryption, atomic lifecycle, RBAC-adjacent ordering and audit redaction.
- Create `apps/api/app/tests/test_admin_llm_api.py` — endpoint dependency and response contracts.
- Create `apps/api/app/tests/test_ai_model_routing.py` — scenario routes, two-call ceiling, fallback, retry selection and usage aggregation.

### Frontend

- Modify `apps/web/lib/api/schemas.ts` — admin LLM schemas and types.
- Create `apps/web/components/admin/AdminLLMWorkspace.tsx` — provider/key/routing/guarded actions UI.
- Create `apps/web/app/app/admin/llm/page.tsx` — dedicated page.
- Modify `apps/web/components/admin/AdminOverviewWorkspace.tsx` — link to LLM operations.
- Modify `apps/web/components/app-shell/AppShell.tsx` — superadmin navigation item.
- Modify `apps/web/styles/globals.css` — token-only responsive layout and states.
- Create `apps/web/tests/unit/admin-llm-workspace.test.tsx` — UI, payload, clearing and secret non-rendering.
- Create `apps/web/tests/unit/admin-llm-contract.test.ts` — Zod contracts.
- Modify `apps/web/tests/unit/ai-assistant-workspace.test.tsx` — exact generation payload excludes `model`.
- Create `apps/web/e2e/helpers/admin-llm-api.ts` — method-aware synthetic backend.
- Create `apps/web/e2e/admin-llm.spec.ts` — superadmin lifecycle flow.
- Create `apps/web/e2e/admin-llm-accessibility.spec.ts` — keyboard and axe coverage.
- Modify `apps/web/e2e/client-workspace-visual.spec.ts` — desktop admin LLM baseline.
- Modify `apps/web/package.json` — include new E2E/a11y specs in existing commands.

---

### Task 1: Persist the singleton provider configuration and define safe schemas

**Files:**
- Create: `apps/api/alembic/versions/20260816_0018_llm_provider_settings.py`
- Create: `apps/api/app/models/llm_provider_setting.py`
- Modify: `apps/api/app/models/__init__.py`
- Modify: `scripts/check_integrity.py:22`
- Create: `apps/api/app/schemas/llm_admin.py`
- Create: `apps/api/app/tests/test_llm_provider_settings_contract.py`

**Interfaces:**
- Produces: `LLMProviderSetting`, `LLMModelRoutesRequest`, `OpenRouterConfigurationResponse`, `OpenRouterCatalogResponse`, `OpenRouterConfigurationUpdateRequest`.
- Consumes: `Base`, `UUIDPrimaryKeyMixin`, `TimestampMixin`, `User`, Pydantic strict schemas.

- [ ] **Step 1: Write failing ORM, migration and schema tests**

```python
def test_llm_provider_setting_has_single_provider_and_all_or_none_routes() -> None:
    table = LLMProviderSetting.__table__
    assert table.c.provider.unique is True
    assert {column.name for column in table.columns if column.name.endswith("_model")} == {
        "review_model", "negative_review_model", "question_model",
        "chat_model", "safety_retry_model", "fallback_model",
    }
    assert any(constraint.name == "ck_llm_provider_settings_routes_complete" for constraint in table.constraints)


def test_admin_llm_update_rejects_partial_routes_and_extra_fields() -> None:
    with pytest.raises(ValidationError):
        OpenRouterConfigurationUpdateRequest.model_validate({"routes": {"review_model": "openai/model"}})
    with pytest.raises(ValidationError):
        LLMModelRoutesRequest.model_validate({**complete_routes(), "secret": "forbidden"})
```

- [ ] **Step 2: Run the contract test and confirm RED**

Run from `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_llm_provider_settings_contract.py -q
```

Expected: collection fails because the model and schemas do not exist.

- [ ] **Step 3: Add migration `20260816_0018`**

Create a table with this authoritative shape:

```python
op.create_table(
    "llm_provider_settings",
    sa.Column("provider", sa.String(32), nullable=False),
    sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column("api_key_encrypted", sa.Text(), nullable=True),
    sa.Column("credential_fingerprint", sa.String(64), nullable=True),
    sa.Column("review_model", sa.String(255), nullable=True),
    sa.Column("negative_review_model", sa.String(255), nullable=True),
    sa.Column("question_model", sa.String(255), nullable=True),
    sa.Column("chat_model", sa.String(255), nullable=True),
    sa.Column("safety_retry_model", sa.String(255), nullable=True),
    sa.Column("fallback_model", sa.String(255), nullable=True),
    sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    sa.CheckConstraint(
        "(review_model IS NULL AND negative_review_model IS NULL AND question_model IS NULL "
        "AND chat_model IS NULL AND safety_retry_model IS NULL AND fallback_model IS NULL) OR "
        "(review_model IS NOT NULL AND negative_review_model IS NOT NULL AND question_model IS NOT NULL "
        "AND chat_model IS NOT NULL AND safety_retry_model IS NOT NULL AND fallback_model IS NOT NULL)",
        name="ck_llm_provider_settings_routes_complete",
    ),
    sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("provider", name="uq_llm_provider_settings_provider"),
)
```

Set `down_revision = "20260813_0017"`; downgrade drops only this table.

- [ ] **Step 4: Add ORM registration and update the integrity head**

Implement `LLMProviderSetting` with matching nullable types and `CheckConstraint`, export it from `app.models`, and change:

```python
EXPECTED_ALEMBIC_HEAD = "20260816_0018"
```

- [ ] **Step 5: Add strict admin schemas**

```python
class LLMModelRoutesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    review_model: str = Field(min_length=1, max_length=255)
    negative_review_model: str = Field(min_length=1, max_length=255)
    question_model: str = Field(min_length=1, max_length=255)
    chat_model: str = Field(min_length=1, max_length=255)
    safety_retry_model: str = Field(min_length=1, max_length=255)
    fallback_model: str = Field(min_length=1, max_length=255)


class OpenRouterConfigurationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    api_key: SecretStr | None = Field(default=None, min_length=16, max_length=512)
    routes: LLMModelRoutesRequest
```

Define safe configuration/catalog response models with `Literal` state/source values and no key field.

- [ ] **Step 6: Run focused tests and static checks**

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_llm_provider_settings_contract.py -q
.\.venv\Scripts\ruff.exe check app/models/llm_provider_setting.py app/schemas/llm_admin.py app/tests/test_llm_provider_settings_contract.py alembic/versions/20260816_0018_llm_provider_settings.py
.\.venv\Scripts\alembic.exe heads
Set-Location ..\..
apps\api\.venv\Scripts\python.exe scripts/check_integrity.py
Set-Location apps\api
```

Expected: focused tests pass, Ruff exits `0`, integrity exits `0`, Alembic prints only `20260816_0018 (head)`.

- [ ] **Step 7: Commit the persistence contract**

```powershell
git add -- apps/api/alembic/versions/20260816_0018_llm_provider_settings.py apps/api/app/models/llm_provider_setting.py apps/api/app/models/__init__.py apps/api/app/schemas/llm_admin.py apps/api/app/tests/test_llm_provider_settings_contract.py scripts/check_integrity.py
git diff --cached --check
git commit -m "feat(ai): persist OpenRouter admin settings"
```

### Task 2: Implement authenticated OpenRouter key and catalog reads

**Files:**
- Modify: `apps/api/app/providers/openrouter.py`
- Modify: `apps/api/app/tests/test_openrouter_provider.py`

**Interfaces:**
- Produces: `OpenRouterKeyMetadata`, `OpenRouterModel`, `OpenRouterProvider.get_current_key()`, `OpenRouterProvider.list_user_models()`.
- Consumes: existing `OpenRouterProviderError`, `httpx.AsyncBaseTransport`, official `/key` and `/models/user` responses.

- [ ] **Step 1: Add failing provider contract tests with `MockTransport`**

```python
async def test_key_validation_and_user_catalog_are_authenticated_and_normalized() -> None:
    recorder = RequestRecorder([
        httpx.Response(200, json={"data": {"is_management_key": False, "is_provisioning_key": False, "label": "masked"}}),
        httpx.Response(200, json={"data": [text_model(), image_only_model(), malformed_model()]}),
    ])
    provider = OpenRouterProvider(api_key="sk-or-v1-test-value", transport=httpx.MockTransport(recorder))
    metadata = await provider.get_current_key()
    models = await provider.list_user_models()
    assert metadata.is_management_key is False
    assert [model.id for model in models] == ["openai/text-model"]
    assert all(request.headers["authorization"] == "Bearer sk-or-v1-test-value" for request in recorder.requests)
```

Also test 401 mapping, management/provisioning metadata, non-object `data`, invalid decimals, oversized ids and provider body non-propagation.

- [ ] **Step 2: Run provider tests and confirm RED**

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_openrouter_provider.py -q
```

Expected: fails because transport injection and catalog methods are missing.

- [ ] **Step 3: Add transport injection and reusable GET request**

```python
def __init__(..., transport: httpx.AsyncBaseTransport | None = None) -> None:
    self.transport = transport

async def _get(self, path: str) -> dict[str, object]:
    self._validate_api_key()
    async with httpx.AsyncClient(timeout=self.timeout_seconds, transport=self.transport) as client:
        response = await client.get(f"{self.base_url}{path}", headers=self._headers())
    data = self._safe_json(response)
    if not response.is_success:
        raise OpenRouterProviderError("OpenRouter request failed", status_code=response.status_code, error_code=self._map_status(response.status_code))
    return data
```

Use the same transport in `complete()` so every provider test remains network-isolated.

- [ ] **Step 4: Implement explicit metadata and catalog parsers**

```python
@dataclass(frozen=True)
class OpenRouterModel:
    id: str
    name: str
    input_modalities: tuple[str, ...]
    output_modalities: tuple[str, ...]
    context_length: int | None
    prompt_price: Decimal | None
    completion_price: Decimal | None
    expiration_date: datetime | None
```

`list_user_models()` reads modalities only from the documented `architecture.input_modalities` and `architecture.output_modalities` fields. It discards entries without bounded `id`/`name`, entries without text output, non-finite prices, descriptions, links, benchmarks and unknown fields. `get_current_key()` exposes only booleans and safe metadata required to reject management/provisioning keys.

- [ ] **Step 5: Run focused provider verification**

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_openrouter_provider.py -q
.\.venv\Scripts\ruff.exe check app/providers/openrouter.py app/tests/test_openrouter_provider.py
```

Expected: all tests pass and no live request occurs.

- [ ] **Step 6: Commit provider reads**

```powershell
git add -- apps/api/app/providers/openrouter.py apps/api/app/tests/test_openrouter_provider.py
git diff --cached --check
git commit -m "feat(ai): validate OpenRouter keys and models"
```

### Task 3: Add configuration service, resolver and superadmin endpoints

**Files:**
- Create: `apps/api/app/services/llm_route_resolver.py`
- Create: `apps/api/app/services/llm_configuration_service.py`
- Create: `apps/api/app/api/admin_llm.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/app/tests/test_llm_configuration_service.py`
- Create: `apps/api/app/tests/test_admin_llm_api.py`

**Interfaces:**
- Produces: `LLMModelRoutes`, `LLMRuntimeConfiguration`, `LLMRouteResolver.select_model()`, `LLMConfigurationService.get_safe_configuration()`, `validate_candidate()`, `save_configuration()`, `disable()`, `remove_local_key()`.
- Consumes: Task 1 schemas/model, Task 2 provider methods, `CredentialService`, `AuditService`, `Settings`, `require_superadmin`.

- [ ] **Step 1: Write failing resolver and lifecycle tests**

```python
def test_route_resolver_uses_existing_negative_threshold() -> None:
    routes = model_routes()
    assert LLMRouteResolver.select_model(routes, message_type="review", rating=2) == routes.negative_review_model
    assert LLMRouteResolver.select_model(routes, message_type="review", rating=3) == routes.review_model
    assert LLMRouteResolver.select_model(routes, message_type="question", rating=None) == routes.question_model
    assert LLMRouteResolver.select_model(routes, message_type="chat", rating=None) == routes.chat_model


async def test_failed_rotation_preserves_ciphertext_and_routes(session, superadmin) -> None:
    existing = await seed_active_configuration(session)
    service = service_with_provider_error(session, "openrouter_auth_error")
    with pytest.raises(HTTPException) as exc:
        await service.save_configuration(actor=superadmin, payload=rotation_payload())
    assert exc.value.detail == "Ключ OpenRouter недействителен."
    assert existing.api_key_encrypted == ORIGINAL_CIPHERTEXT
    assert existing.review_model == "openai/original"
```

Cover no-row environment bootstrap, database precedence, explicit disabled override, the unconfigured `replace-` environment sentinel, complete route validation, safe audit metadata and delete-local-key semantics.

- [ ] **Step 2: Run service tests and confirm RED**

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_llm_configuration_service.py app/tests/test_admin_llm_api.py -q
```

Expected: collection fails because the service and router do not exist.

- [ ] **Step 3: Implement pure route and runtime types**

```python
@dataclass(frozen=True)
class LLMModelRoutes:
    review_model: str
    negative_review_model: str
    question_model: str
    chat_model: str
    safety_retry_model: str
    fallback_model: str


@dataclass(frozen=True)
class LLMRuntimeConfiguration:
    api_key: str
    source: Literal["database", "environment"]
    routes: LLMModelRoutes
```

`select_model()` accepts only existing `MessageType` values and raises a safe configuration error for any unsupported type.

- [ ] **Step 4: Implement exact source precedence and provider factory injection**

```python
class LLMConfigurationService:
    def __init__(self, session: AsyncSession, *, provider_factory: Callable[[str], OpenRouterProvider] | None = None) -> None:
        self.session = session
        self.settings = get_settings()
        self.credentials = CredentialService(self.settings.credentials_encryption_key.get_secret_value())
        self.provider_factory = provider_factory or self._default_provider

    async def resolve_runtime(self) -> LLMRuntimeConfiguration:
        row = await self._get_row()
        if row is not None and not row.enabled:
            raise LLMConfigurationError("openrouter_disabled")
        if row is not None and row.api_key_encrypted:
            key = self.credentials.decrypt(row.api_key_encrypted)
            source = "database"
        else:
            key = self._configured_environment_key()
            source = "environment"
        return LLMRuntimeConfiguration(api_key=key, source=source, routes=self._effective_routes(row))
```

Do not catch `CredentialEncryptionError` into a response containing internal details; map it to `openrouter_configuration_error`.

- [ ] **Step 5: Implement candidate validation and atomic save**

`validate_candidate()` must call `/key` before `/models/user`, reject management/provisioning keys and return only `OpenRouterCatalogResponse`. `save_configuration()` revalidates the supplied/current key, checks all six ids against the fresh catalog, then encrypts and flushes the row in the same transaction. Failed validation performs no assignment and no flush.

Audit metadata shape:

```python
{
    "provider": "openrouter",
    "source": "database",
    "credential_fingerprint_masked": CredentialService.mask_fingerprint(fingerprint),
    "models": payload.routes.model_dump(),
}
```

Never include `api_key`, ciphertext or provider data.

- [ ] **Step 6: Add superadmin endpoints and dependency-order tests**

```python
router = APIRouter(prefix="/api/admin/llm/openrouter", tags=["admin-llm"])

@router.post("/validate", response_model=OpenRouterCatalogResponse)
async def validate_openrouter_key(
    payload: OpenRouterKeyValidateRequest,
    current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> OpenRouterCatalogResponse:
    return await LLMConfigurationService(session).validate_candidate(actor=current_user, api_key=payload.api_key.get_secret_value())
```

Add GET configuration, POST models refresh, PUT save, POST disable and DELETE local key. Commit after successful mutation. Register the router in `main.py` and add `PUT` to allowed CORS methods.

Test that a non-superadmin receives 403 and provider factory/decrypt spies have zero calls.

- [ ] **Step 7: Run the focused configuration/API gate**

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_llm_provider_settings_contract.py app/tests/test_openrouter_provider.py app/tests/test_llm_configuration_service.py app/tests/test_admin_llm_api.py app/tests/test_admin_access.py -q
.\.venv\Scripts\ruff.exe check app/api/admin_llm.py app/services/llm_configuration_service.py app/services/llm_route_resolver.py app/tests/test_llm_configuration_service.py app/tests/test_admin_llm_api.py
```

Expected: all focused tests pass and Ruff exits `0`.

- [ ] **Step 8: Commit the admin backend**

```powershell
git add -- apps/api/app/api/admin_llm.py apps/api/app/main.py apps/api/app/services/llm_configuration_service.py apps/api/app/services/llm_route_resolver.py apps/api/app/tests/test_llm_configuration_service.py apps/api/app/tests/test_admin_llm_api.py
git diff --cached --check
git commit -m "feat(admin): manage OpenRouter configuration"
```

### Task 4: Make AI routing authoritative and enforce the two-attempt policy

**Files:**
- Modify: `apps/api/app/services/ai_service.py`
- Modify: `apps/api/app/schemas/ai.py`
- Modify: `apps/api/app/api/ai.py`
- Create: `apps/api/app/tests/test_ai_model_routing.py`

**Interfaces:**
- Consumes: `LLMConfigurationService.resolve_runtime()`, `LLMRouteResolver.select_model()`, existing `SafetyGate`, `OpenRouterProvider.complete()`.
- Produces: authoritative backend route selection, no public model override, aggregate attempt usage and safe routing audit fields.

- [ ] **Step 1: Write failing route, retry and request-contract tests**

```python
def test_generate_request_rejects_client_model_override() -> None:
    with pytest.raises(ValidationError):
        AIDraftGenerateRequest.model_validate({"message_id": str(uuid4()), "model": "openai/arbitrary"})


async def test_safety_retry_chooses_safer_candidate_and_stops_at_two_calls(ai_harness) -> None:
    ai_harness.provider.completions = [manual_review_completion(0.60), allowed_completion(0.91)]
    draft = await ai_harness.generate(message_type="review", rating=2)
    assert ai_harness.provider.models == ["approved/negative", "approved/safety"]
    assert draft.model == "approved/safety"
    assert draft.tokens_input == 30
    assert draft.tokens_output == 12
    assert draft.cost_estimate == Decimal("0.003")
```

Also test ordinary review/question/chat routes, missing-context-only no retry, transient fallback, auth failure no retry, failed quality retry retaining the first completion, tied candidates choosing the first and a hard assertion `len(provider.calls) <= 2` in every case.

- [ ] **Step 2: Run routing tests and confirm RED**

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_ai_model_routing.py -q
```

Expected: fails because the request still accepts model and AIService uses environment models directly.

- [ ] **Step 3: Remove the public model override**

Delete `model` from `AIDraftGenerateRequest`, the `generate_ai_draft()` forwarding argument and `AIService.generate_draft()`. Keep `extra="forbid"` so old arbitrary-model callers receive a validation failure rather than being silently ignored.

- [ ] **Step 4: Resolve runtime configuration before constructing the provider**

```python
runtime = await self.llm_configuration.resolve_runtime()
selected_model = LLMRouteResolver.select_model(
    runtime.routes,
    message_type=message.type,
    rating=message.rating,
)
provider = self.provider_factory(runtime)
```

Inject configuration/provider factories through optional constructor arguments so tests use fakes and production uses existing settings.

- [ ] **Step 5: Implement the bounded attempt state machine**

Represent each successful attempt as:

```python
@dataclass(frozen=True)
class GenerationCandidate:
    completion: LLMCompletion
    parsed: ParsedModelOutput
    safety: SafetyResult
```

Execution order is exact:

- scenario request;
- transient provider failure -> one fallback request and stop;
- successful but non-ALLOW result -> one safety model request only when flags intersect `{"low_confidence", "risky_promise", "medical_or_legal_claim", "unclear_customer_issue", "needs_manual_review", "sensitive_topic", "seller_prohibited_phrase", "unsafe_instruction", "personal_data_exposure", "policy_violation"}`;
- failed quality retry -> keep first candidate;
- auth/configuration/malformed errors -> no retry.

Select by decision rank `{ALLOW: 2, MANUAL_REVIEW: 1, BLOCK: 0}`, then confidence, then first attempt.

- [ ] **Step 6: Aggregate all successful-attempt usage**

Set draft token counts, latency and cost to safe sums over successful attempts. The selected draft keeps the chosen model/text/confidence/flags. Extend usage and audit metadata with:

```python
{
    "routing_key": routing_key,
    "models_attempted": requested_model_ids,
    "attempt_count": provider_call_count,
    "retry_class": retry_class,
    "safety_decision": selected.safety.decision.value,
}
```

Do not add prompt, reply or customer content.

- [ ] **Step 7: Run focused AI and safety tests**

```powershell
.\.venv\Scripts\python.exe -m pytest app/tests/test_ai_model_routing.py app/tests/test_openrouter_provider.py app/tests/test_manual_reply_safety.py app/tests/test_plan_limits.py -q
.\.venv\Scripts\ruff.exe check app/services/ai_service.py app/schemas/ai.py app/api/ai.py app/tests/test_ai_model_routing.py
```

Expected: all pass with every fake provider call count at two or less.

- [ ] **Step 8: Commit authoritative routing**

```powershell
git add -- apps/api/app/services/ai_service.py apps/api/app/schemas/ai.py apps/api/app/api/ai.py apps/api/app/tests/test_ai_model_routing.py
git diff --cached --check
git commit -m "feat(ai): route drafts through admin models"
```

### Task 5: Build the superadmin LLM workspace

**Files:**
- Modify: `apps/web/lib/api/schemas.ts`
- Create: `apps/web/components/admin/AdminLLMWorkspace.tsx`
- Create: `apps/web/app/app/admin/llm/page.tsx`
- Modify: `apps/web/components/admin/AdminOverviewWorkspace.tsx`
- Modify: `apps/web/components/app-shell/AppShell.tsx`
- Modify: `apps/web/styles/globals.css`
- Create: `apps/web/tests/unit/admin-llm-contract.test.ts`
- Create: `apps/web/tests/unit/admin-llm-workspace.test.tsx`
- Modify: `apps/web/tests/unit/ai-assistant-workspace.test.tsx`

**Interfaces:**
- Consumes: Task 3 safe endpoints and exact response schemas.
- Produces: superadmin status/key/catalog/routing/disable/remove workflows without secret rendering.

- [ ] **Step 1: Write failing Zod contract tests**

```typescript
it("rejects key material in the safe configuration response", () => {
  expect(() => openRouterConfigurationSchema.parse({ ...safeConfiguration, api_key: "secret" })).toThrow();
});

it("accepts only the six routing keys", () => {
  expect(openRouterRoutesSchema.parse(routes)).toEqual(routes);
  expect(() => openRouterRoutesSchema.parse({ ...routes, arbitrary_model: "x/y" })).toThrow();
});
```

- [ ] **Step 2: Write failing workspace behavior tests**

Test that:

- non-superadmin makes no request;
- raw/encrypted key strings are absent from the DOM;
- validate POST contains only the entered candidate key;
- save PUT contains key plus all six routes and clears the password input after success;
- route-only save omits `api_key`;
- failed rotation retains input and active displayed state;
- disable/remove require `window.confirm` and use the exact endpoints;
- copy says local removal does not revoke the OpenRouter key.

Representative assertion:

```typescript
expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual({
  api_key: "candidate-key-value",
  routes,
});
expect(screen.getByLabelText("Новый ключ OpenRouter")).toHaveValue("");
expect(screen.queryByDisplayValue(safeConfiguration.credential_fingerprint_masked)).not.toBeInTheDocument();
```

- [ ] **Step 3: Run unit tests and confirm RED**

```powershell
npx vitest run tests/unit/admin-llm-contract.test.ts tests/unit/admin-llm-workspace.test.tsx tests/unit/ai-assistant-workspace.test.tsx --maxWorkers=1
```

Expected: new files/components are missing and the exact payload contract is not implemented.

- [ ] **Step 4: Add strict frontend schemas**

Use `.strict()` for configuration, catalog, route and mutation-response objects. Export `OpenRouterConfiguration`, `OpenRouterCatalogModel` and `OpenRouterRoutes` types. No schema contains `api_key` except the outbound request type local to the component.

- [ ] **Step 5: Implement the operational component**

Use TanStack Query keys:

```typescript
["admin", "llm", "openrouter", "configuration"]
["admin", "llm", "openrouter", "models"]
```

The component renders flat sections for status, blank password input, catalog load, six selectors and guarded actions. Use one shared search field to filter a normalized catalog and native labeled selects for routes; do not add a combobox dependency. Preserve stale selected ids as disabled warning options until replaced.

Map safe backend categories to Russian copy in one exhaustive function. Do not render raw `error.message` for provider-specific errors.

- [ ] **Step 6: Add the page and superadmin navigation**

Create `/app/admin/llm` with one H1 and operational copy. Add `LLM и модели` beside `Обзор` in the superadmin system navigation. Add a normal link from the overview without changing customer navigation.

- [ ] **Step 7: Add token-only responsive CSS**

Add `.admin-llm-*` layout rules using existing `--color-*`, `--space-*`, `--radius-*`, typography and focus tokens. Do not add gradients, glass, glows, nested card grids or motion. At `max-width: 768px`, stack status details, labels and actions with no horizontal overflow.

- [ ] **Step 8: Remove model from the AI assistant payload contract**

Keep the draft response `model` display, but assert generation requests contain no `model` field:

```typescript
expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
  message_id: message.id,
  tone: "friendly",
  temperature: 0.3,
  max_tokens: 600,
  brand_rules: "Обращаться на Вы",
  knowledge_base: undefined,
});
```

Adjust the exact assertion to omit undefined values produced by `JSON.stringify`.

- [ ] **Step 9: Run focused frontend checks**

```powershell
npx vitest run tests/unit/admin-llm-contract.test.ts tests/unit/admin-llm-workspace.test.tsx tests/unit/ai-assistant-workspace.test.tsx --maxWorkers=1
npm run design:detect
npm run typecheck
npm run lint
```

Expected: all exit `0` and no new design warning is accepted without fixing it.

- [ ] **Step 10: Commit the admin workspace**

```powershell
git add -- apps/web/lib/api/schemas.ts apps/web/components/admin/AdminLLMWorkspace.tsx apps/web/app/app/admin/llm/page.tsx apps/web/components/admin/AdminOverviewWorkspace.tsx apps/web/components/app-shell/AppShell.tsx apps/web/styles/globals.css apps/web/tests/unit/admin-llm-contract.test.ts apps/web/tests/unit/admin-llm-workspace.test.tsx apps/web/tests/unit/ai-assistant-workspace.test.tsx
git diff --cached --check
git commit -m "feat(admin): add LLM model workspace"
```

### Task 6: Add browser lifecycle, accessibility and visual coverage

**Files:**
- Create: `apps/web/e2e/helpers/admin-llm-api.ts`
- Create: `apps/web/e2e/admin-llm.spec.ts`
- Create: `apps/web/e2e/admin-llm-accessibility.spec.ts`
- Modify: `apps/web/e2e/client-workspace-visual.spec.ts`
- Modify: `apps/web/package.json`
- Create after reviewed test run: `apps/web/e2e/client-workspace-visual.spec.ts-snapshots/admin-llm-desktop-chromium-win32.png`

**Interfaces:**
- Consumes: completed admin UI and HTTP contracts.
- Produces: method-aware browser proof with no provider calls.

- [ ] **Step 1: Create a method-aware synthetic admin API helper**

The helper must return explicit 500 for undeclared method/path pairs. Keep state in memory:

```typescript
type AdminLLMState = {
  configuration: OpenRouterConfiguration;
  catalog: OpenRouterCatalogResponse;
};

if (pathname === "/api/admin/llm/openrouter/validate" && method === "POST") { /* catalog */ }
else if (pathname === "/api/admin/llm/openrouter" && method === "PUT") { /* active database state */ }
else return route.fulfill({ status: 500, json: { detail: `Unexpected ${method} ${pathname}` } });
```

- [ ] **Step 2: Write the lifecycle browser spec**

Cover superadmin navigation, validate/load, search, six selections, save, cleared input, masked fingerprint, failed rotation preservation, explicit disable and non-superadmin 403 UI. Assert captured request bodies never appear in screenshots or page text.

- [ ] **Step 3: Write accessibility coverage**

At desktop and `390x844`, assert one H1, labeled password/search/select fields, keyboard reachable actions, visible focus and `axe` with no violations. Confirm the password input uses `type="password"` and `autocomplete="new-password"`.

- [ ] **Step 4: Add one reviewed visual case**

Add only the populated active-state desktop snapshot at `1440x1000`. Run once without update first; expected failure is missing snapshot. Inspect the rendered page before generating the baseline, then run the targeted update command exactly once.

- [ ] **Step 5: Register specs in package commands**

Append `e2e/admin-llm.spec.ts` to `test:e2e` and `e2e/admin-llm-accessibility.spec.ts` to `test:a11y`. Add the visual case to the already included `client-workspace-visual.spec.ts`; do not create another visual command.

- [ ] **Step 6: Run focused browser checks**

```powershell
npx playwright test e2e/admin-llm.spec.ts --project=chromium
npx playwright test e2e/admin-llm-accessibility.spec.ts --project=chromium
npx playwright test e2e/client-workspace-visual.spec.ts --project=chromium --grep "admin LLM"
```

If the last command fails only because the reviewed baseline is missing, inspect the screenshot, then run:

```powershell
npx playwright test e2e/client-workspace-visual.spec.ts --project=chromium --grep "admin LLM" --update-snapshots
npx playwright test e2e/client-workspace-visual.spec.ts --project=chromium --grep "admin LLM"
```

Expected: lifecycle and a11y pass; final visual rerun passes.

- [ ] **Step 7: Commit browser contracts**

```powershell
git add -- apps/web/e2e/helpers/admin-llm-api.ts apps/web/e2e/admin-llm.spec.ts apps/web/e2e/admin-llm-accessibility.spec.ts apps/web/e2e/client-workspace-visual.spec.ts apps/web/e2e/client-workspace-visual.spec.ts-snapshots/admin-llm-desktop-chromium-win32.png apps/web/package.json
git diff --cached --check
git commit -m "test(admin): cover OpenRouter configuration flows"
```

### Task 7: Run the full release-candidate gate and update draft PR evidence

**Files:**
- Modify only if needed for truthful status: `DEVELOPMENT_STATUS_0.1.104.md`
- Update existing draft PR `#11` body through `gh`; no merge.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: exact-SHA local and remote verification evidence with explicit live-runtime limitations.

- [ ] **Step 1: Review changed scope before the full gate**

```powershell
git status --short --branch
git diff origin/codex/0.1.104-backend...HEAD --name-only
git log --oneline origin/codex/0.1.104-backend..HEAD
```

Expected: only the approved OpenRouter spec/plan/implementation/test files plus intentional integrity/status changes.

- [ ] **Step 2: Run the complete backend gate once**

From repository root:

```powershell
apps\api\.venv\Scripts\python.exe scripts\check_integrity.py
Set-Location apps\api
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check app alembic
npx --yes pyright@1.1.411 --pythonpath .\.venv\Scripts\python.exe app
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m compileall -q app alembic
.\.venv\Scripts\alembic.exe heads
Set-Location ..\..
```

Expected: all tests/checks pass; one Alembic head `20260816_0018`.

- [ ] **Step 3: Run the complete frontend gate once**

```powershell
Set-Location apps\web
npm run test:frontend
npm run design:detect
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
Set-Location ..\..
```

Expected: every command exits `0`; snapshots are not regenerated during this gate.

- [ ] **Step 4: Run repository diff and container gates**

```powershell
git diff --check HEAD
pwsh -NoProfile -File scripts\container-gate.ps1
```

Expected: clean diff check and container gate pass. If Docker is unavailable, report the exact blocked gate and do not claim it passed.

- [ ] **Step 5: Update truthful development status if the existing file is stale**

Document only verified facts:

- encrypted platform OpenRouter configuration and scenario routing are implemented;
- all automated tests use synthetic transports;
- no live OpenRouter key, billing, model completion or marketplace request was used;
- marketplace runtime certification remains separate.

Run `git diff --check` and commit only if the status file changed:

```powershell
git add -- DEVELOPMENT_STATUS_0.1.104.md
git commit -m "docs(ai): record admin routing readiness"
```

- [ ] **Step 6: Push the current branch and verify exact-SHA Quality Gate**

```powershell
git push origin codex/0.1.104-backend
$sha = git rev-parse HEAD
gh run list --branch codex/0.1.104-backend --workflow "Quality Gate" --limit 5
```

Wait for the run whose `headSha` equals `$sha`. Require backend, frontend and containers to succeed. Do not reuse an older run.

- [ ] **Step 7: Update the existing draft PR without changing release state**

Update PR `#11` body with:

- exact head SHA and Quality Gate run URL;
- local backend/frontend/browser/container results actually observed;
- OpenRouter admin configuration scope;
- no live OpenRouter or marketplace calls;
- no merge, deploy, tag or version bump;
- marketplace runtime states remain unverified except exact existing evidence.

Confirm:

```powershell
gh pr view 11 --json isDraft,state,headRefOid,mergeStateStatus,statusCheckRollup,url
git status --short --branch
```

Expected: PR remains draft/open, head SHA matches local HEAD, checks are green and worktree is clean.

## Plan self-review record

- Spec coverage: persistence, environment bootstrap, explicit disable, catalog, six routes, authoritative backend selection, two-attempt policy, safe auditing, admin UI and all verification gates each have an owning task.
- Completion-marker scan: no unfinished marker, deferred implementation instruction or undefined neighboring interface remains.
- Type consistency: the same six route names flow from Pydantic schemas to ORM, resolver, API, Zod and UI; runtime source values are `database | environment`, while the safe view additionally represents `none`.
- Scope: this plan completes the OpenRouter admin/routing increment only. Marketplace live certification remains a separate credential-dependent plan.
