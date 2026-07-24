import { z } from "zod";

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().min(1);

export const userSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string().nullable(),
  status: z.string(),
  is_superadmin: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const authSessionSchema = z.object({
  user: userSchema,
});

export const organizationRoleSchema = z.enum(["owner", "admin", "manager", "viewer"]);

export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  owner_user_id: uuidSchema.nullable(),
  plan_id: uuidSchema.nullable(),
  default_response_mode: z.string(),
  status: z.string(),
  current_user_role: organizationRoleSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const organizationListSchema = z.array(organizationSchema);

export const automationRuleSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  marketplace_account_id: uuidSchema.nullable(),
  name: z.string(),
  priority: z.number().int().min(0).max(10000),
  is_enabled: z.boolean(),
  mode: z.enum(["auto", "semi_auto"]),
  applies_to: z.enum(["all", "review", "question"]),
  marketplace: z.enum(["wildberries", "ozon", "yandex_market", "avito"]).nullable(),
  min_rating: z.number().int().min(1).max(5).nullable(),
  max_rating: z.number().int().min(1).max(5).nullable(),
  product_ids: z.array(z.string()),
  category_ids: z.array(z.string()),
  include_keywords: z.array(z.string()),
  exclude_keywords: z.array(z.string()),
  sensitive_topics: z.array(z.string()),
  daily_limit: z.number().int().positive().nullable(),
  hourly_limit: z.number().int().positive().nullable(),
  require_manual_review_on_flags: z.boolean(),
  stop_on_missing_product_context: z.boolean(),
  stop_on_low_confidence: z.boolean(),
  confidence_threshold: z.number().min(0).max(1),
  created_by: uuidSchema.nullable(),
  updated_by: uuidSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const automationRuleListSchema = z.object({
  items: z.array(automationRuleSchema),
  total: z.number().int().nonnegative(),
});

export const automationRuleActionSchema = z.object({
  ok: z.boolean(),
  id: uuidSchema,
  is_enabled: z.boolean(),
});

export const productSummarySchema = z.object({
  id: uuidSchema,
  external_id: z.string(),
  sku: z.string().nullable(),
  name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  image_url: z.string().nullable(),
  product_url: z.string().nullable(),
});

export const customerMessageSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  marketplace_account_id: uuidSchema,
  product_id: uuidSchema.nullable(),
  marketplace: z.string(),
  external_id: z.string(),
  type: z.string(),
  status: z.string(),
  rating: z.number().int().nullable(),
  customer_display_name: z.string().nullable(),
  customer_text: z.string(),
  customer_photos_json: z.array(z.unknown()),
  marketplace_created_at: timestampSchema,
  imported_at: timestampSchema,
  last_synced_at: timestampSchema,
  assigned_to: uuidSchema.nullable(),
  priority: z.string(),
  metadata_json: z.record(z.string(), z.unknown()),
  product: productSummarySchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const customerMessageListSchema = z.object({
  items: z.array(customerMessageSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});

export const aiDraftSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  message_id: uuidSchema,
  provider: z.string().min(1),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
  draft_text: z.string().min(1),
  tokens_input: z.number().int().nonnegative().nullable(),
  tokens_output: z.number().int().nonnegative().nullable(),
  latency_ms: z.number().int().nonnegative().nullable(),
  cost_estimate: z.number().nonnegative().nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),
  safety_flags_json: z.array(z.string()),
  created_by: uuidSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const aiDraftListSchema = z.object({
  items: z.array(aiDraftSchema),
  total: z.number().int().nonnegative(),
});

export const replySchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  message_id: uuidSchema,
  ai_draft_id: uuidSchema.nullable(),
  automation_rule_id: uuidSchema.nullable(),
  reply_text: z.string(),
  status: z.string(),
  mode: z.string(),
  revision: z.number().int().positive(),
  idempotency_key: z.string().nullable(),
  worker_message_id: z.string().nullable(),
  attempt_count: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  last_attempt_at: timestampSchema.nullable(),
  next_retry_at: timestampSchema.nullable(),
  error_code: z.string().nullable(),
  created_by: uuidSchema.nullable(),
  approved_by: uuidSchema.nullable(),
  sent_by: uuidSchema.nullable(),
  submitted_for_review_at: timestampSchema.nullable(),
  approved_at: timestampSchema.nullable(),
  rejected_at: timestampSchema.nullable(),
  rejection_reason: z.string().nullable(),
  marketplace_reply_id: z.string().nullable(),
  sent_at: timestampSchema.nullable(),
  failed_reason: z.string().nullable(),
  metadata_json: z.record(z.string(), z.unknown()),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const safetySummarySchema = z.object({
  decision: z.string(),
  flags: z.array(z.string()),
  reasons: z.array(z.string()),
});

export const manualReplyWorkflowSchema = z.object({
  reply: replySchema,
  safety: safetySummarySchema,
});

export const manualReplySendSchema = z.object({
  queued: z.boolean(),
  duplicate: z.boolean(),
  reply_id: uuidSchema,
  worker_message_id: z.string().nullable(),
  status: z.string(),
});

export const reviewQueueItemSchema = z.object({
  reply: replySchema,
  message: customerMessageSchema,
  safety: safetySummarySchema,
});

export const reviewQueueListSchema = z.object({
  items: z.array(reviewQueueItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});

export const marketplaceAccountSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  marketplace: z.string().min(1),
  display_name: z.string().min(1),
  seller_id: z.string().nullable(),
  status: z.string().min(1),
  credentials_masked: z.string().min(1),
  credentials_status: z.string().min(1),
  scopes_json: z.record(z.string(), z.unknown()),
  default_response_mode: z.string().min(1),
  last_success_sync_at: timestampSchema.nullable(),
  last_error_sync_at: timestampSchema.nullable(),
  error_count: z.number().int().nonnegative(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const marketplaceAccountListSchema = z.array(marketplaceAccountSchema);

export const marketplaceAccountValidateSchema = z.object({
  id: uuidSchema,
  status: z.string().min(1),
  credentials_status: z.string().min(1),
  scopes: z.array(z.string()),
  checked_at: timestampSchema,
  error_code: z.string().nullable(),
  error_message_safe: z.string().nullable(),
});

export const marketplaceAccountActionSchema = z.object({
  id: uuidSchema,
  status: z.string().min(1),
  credentials_status: z.string().min(1),
  credentials_masked: z.string().min(1),
  message: z.string().min(1),
});

export const marketplaceSyncSchema = z.object({
  account_id: uuidSchema,
  marketplace: z.string().min(1),
  status: z.enum(["success", "failed"]),
  imported_reviews: z.number().int().nonnegative(),
  imported_questions: z.number().int().nonnegative(),
  updated_reviews: z.number().int().nonnegative(),
  updated_questions: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  error_code: z.string().nullable(),
  error_message_safe: z.string().nullable(),
});

export const marketplaceSyncStateSchema = z.object({
  id: uuidSchema,
  marketplace_account_id: uuidSchema,
  stream: z.string().min(1),
  status: z.string().min(1),
  next_run_at: timestampSchema.nullable(),
  last_attempt_at: timestampSchema.nullable(),
  last_success_at: timestampSchema.nullable(),
  last_error_at: timestampSchema.nullable(),
  last_cycle_completed_at: timestampSchema.nullable(),
  consecutive_failures: z.number().int().nonnegative(),
});

export const marketplaceSyncJobSummarySchema = z.object({
  id: uuidSchema,
  job_type: z.string().min(1),
  status: z.string().min(1),
  started_at: timestampSchema.nullable(),
  finished_at: timestampSchema.nullable(),
  error_message_safe: z.string().nullable(),
  stats: z.record(z.string(), z.number().int().nonnegative()),
  created_at: timestampSchema,
});

export const marketplaceIntegrationEventSummarySchema = z.object({
  id: uuidSchema,
  event_type: z.string().min(1),
  status: z.string().min(1),
  error_code: z.string().nullable(),
  error_message_safe: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  created_at: timestampSchema,
});

export const marketplaceAccountOverviewSchema = z.object({
  account: marketplaceAccountSchema,
  health_status: z.enum(["healthy", "attention", "error", "disabled"]),
  health_reasons: z.array(z.string()),
  scopes: z.array(z.string()),
  sync_states: z.array(marketplaceSyncStateSchema),
  recent_jobs: z.array(marketplaceSyncJobSummarySchema),
  recent_events: z.array(marketplaceIntegrationEventSummarySchema),
});

export type MarketplaceAccount = z.infer<typeof marketplaceAccountSchema>;
export type MarketplaceAccountValidate = z.infer<typeof marketplaceAccountValidateSchema>;
export type MarketplaceAccountAction = z.infer<typeof marketplaceAccountActionSchema>;
export type MarketplaceAccountOverview = z.infer<typeof marketplaceAccountOverviewSchema>;
export type MarketplaceSyncState = z.infer<typeof marketplaceSyncStateSchema>;
export type MarketplaceSyncJobSummary = z.infer<typeof marketplaceSyncJobSummarySchema>;
export type MarketplaceIntegrationEventSummary = z.infer<typeof marketplaceIntegrationEventSummarySchema>;
export type MarketplaceSync = z.infer<typeof marketplaceSyncSchema>;

export const messageResponseSchema = z.object({
  message: z.string(),
});

export type User = z.infer<typeof userSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type AutomationRule = z.infer<typeof automationRuleSchema>;
export type AutomationRuleList = z.infer<typeof automationRuleListSchema>;
export type CustomerMessage = z.infer<typeof customerMessageSchema>;
export type CustomerMessageList = z.infer<typeof customerMessageListSchema>;
export type AIDraft = z.infer<typeof aiDraftSchema>;
export type AIDraftList = z.infer<typeof aiDraftListSchema>;
export type Reply = z.infer<typeof replySchema>;
export type SafetySummary = z.infer<typeof safetySummarySchema>;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewQueueList = z.infer<typeof reviewQueueListSchema>;

export const analyticsPeriodSchema = z.object({
  start: timestampSchema,
  end: timestampSchema,
  days: z.number().int().min(1).max(366),
});

export const analyticsOverviewSchema = z.object({
  period: analyticsPeriodSchema,
  total_messages: z.number().int().nonnegative(),
  new_messages: z.number().int().nonnegative(),
  unanswered_messages: z.number().int().nonnegative(),
  answered_messages: z.number().int().nonnegative(),
  negative_reviews: z.number().int().nonnegative(),
  replies_sent: z.number().int().nonnegative(),
  auto_replies_sent: z.number().int().nonnegative(),
  manual_replies_sent: z.number().int().nonnegative(),
  ai_drafts_generated: z.number().int().nonnegative(),
  average_response_seconds: z.number().nonnegative().nullable(),
  ai_acceptance_rate: z.number().min(0).max(1).nullable(),
});

export const messageAnalyticsSchema = z.object({
  period: analyticsPeriodSchema,
  points: z.array(z.object({
    date: z.string(),
    imported: z.number().int().nonnegative(),
    answered: z.number().int().nonnegative(),
  })),
});

export const marketplaceAnalyticsSchema = z.object({
  period: analyticsPeriodSchema,
  items: z.array(z.object({
    marketplace: z.string(),
    messages: z.number().int().nonnegative(),
    answered: z.number().int().nonnegative(),
    failed_integration_events: z.number().int().nonnegative(),
  })),
});

export const productAnalyticsSchema = z.object({
  period: analyticsPeriodSchema,
  items: z.array(z.object({
    product_id: uuidSchema,
    name: z.string(),
    sku: z.string().nullable(),
    messages: z.number().int().nonnegative(),
    negative_reviews: z.number().int().nonnegative(),
  })),
});

export const teamAnalyticsSchema = z.object({
  period: analyticsPeriodSchema,
  items: z.array(z.object({
    user_id: uuidSchema,
    email: z.string().email(),
    name: z.string().nullable(),
    replies_sent: z.number().int().nonnegative(),
  })),
});

export const aiUsageAnalyticsSchema = z.object({
  period: analyticsPeriodSchema,
  drafts_generated: z.number().int().nonnegative(),
  tokens_input: z.number().int().nonnegative(),
  tokens_output: z.number().int().nonnegative(),
  cost_estimate: z.number().nonnegative(),
  average_latency_ms: z.number().nonnegative().nullable(),
  safety_flagged_drafts: z.number().int().nonnegative(),
  models: z.array(z.object({
    model: z.string(),
    drafts: z.number().int().nonnegative(),
    tokens_input: z.number().int().nonnegative(),
    tokens_output: z.number().int().nonnegative(),
    cost_estimate: z.number().nonnegative(),
    average_latency_ms: z.number().nonnegative().nullable(),
  })),
});

export const billingPlanSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  price_month_minor: z.number().int().nonnegative().nullable(),
  currency: z.string(),
  limits_json: z.record(z.string(), z.unknown()),
  features_json: z.record(z.string(), z.unknown()),
  is_active: z.boolean(),
  is_default: z.boolean(),
});

export const subscriptionSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  plan_id: uuidSchema,
  status: z.string(),
  current_period_start: timestampSchema.nullable(),
  current_period_end: timestampSchema.nullable(),
  trial_ends_at: timestampSchema.nullable(),
  cancel_at_period_end: z.boolean(),
  provider: z.string().nullable(),
  provider_customer_id: z.string().nullable(),
  provider_subscription_id: z.string().nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const billingOverviewSchema = z.object({
  organization_id: uuidSchema,
  plan: billingPlanSchema,
  subscription: subscriptionSchema.nullable(),
  usage_period_start: timestampSchema,
  usage_period_end: timestampSchema,
  usage: z.array(z.object({
    metric: z.string(),
    used: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative().nullable(),
    remaining: z.number().int().nonnegative().nullable(),
    allowed: z.boolean(),
  })),
  pricing_finalized: z.boolean(),
});

export const adminOverviewSchema = z.object({
  generated_at: timestampSchema,
  organizations_total: z.number().int().nonnegative(),
  organizations_active: z.number().int().nonnegative(),
  users_total: z.number().int().nonnegative(),
  subscriptions_active: z.number().int().nonnegative(),
  usage_events_30d: z.number().int().nonnegative(),
  ai_cost_estimate_30d: z.number().nonnegative(),
  integration_failures_24h: z.number().int().nonnegative(),
  replies_failed_24h: z.number().int().nonnegative(),
});

export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;
export type MessageAnalytics = z.infer<typeof messageAnalyticsSchema>;
export type MarketplaceAnalytics = z.infer<typeof marketplaceAnalyticsSchema>;
export type ProductAnalytics = z.infer<typeof productAnalyticsSchema>;
export type TeamAnalytics = z.infer<typeof teamAnalyticsSchema>;
export type AIUsageAnalytics = z.infer<typeof aiUsageAnalyticsSchema>;
export type BillingOverview = z.infer<typeof billingOverviewSchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
