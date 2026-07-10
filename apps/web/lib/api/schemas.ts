import { z } from "zod";

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().min(1);

export const userSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string().nullable(),
  status: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const authSessionSchema = z.object({
  user: userSchema,
});

export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  owner_user_id: uuidSchema.nullable(),
  default_response_mode: z.string(),
  status: z.string(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const organizationListSchema = z.array(organizationSchema);

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

export const messageResponseSchema = z.object({
  message: z.string(),
});

export type User = z.infer<typeof userSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type CustomerMessage = z.infer<typeof customerMessageSchema>;
export type CustomerMessageList = z.infer<typeof customerMessageListSchema>;
export type Reply = z.infer<typeof replySchema>;
export type SafetySummary = z.infer<typeof safetySummarySchema>;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewQueueList = z.infer<typeof reviewQueueListSchema>;
