# Automation Rules Engine v1

## Purpose

Choose how MPReply handles a marketplace message before the future auto-send stage.

## Inputs

- organization default response mode;
- marketplace account response-mode override;
- marketplace and account id;
- message type;
- rating;
- product and category context;
- customer text;
- optional AI confidence score;
- ordered enabled automation rules.

## Match conditions

A rule may constrain:

- marketplace account;
- marketplace;
- message type;
- rating range;
- product ids;
- category ids;
- include keywords;
- exclude keywords;
- sensitive topics.

The highest-priority matching rule wins.

## Output

- selected mode: `auto` or `semi_auto`;
- matched rule id and name;
- decision reasons;
- whether manual review is required;
- whether runtime quota checks are required.

## Non-goal in Sprint 6

The engine does not send replies and does not claim hourly/daily quotas were enforced. Those counters belong to the worker-backed auto-reply execution workflow.
