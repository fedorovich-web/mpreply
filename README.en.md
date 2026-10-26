[Русский](README.md) · [English](README.en.md)

# MPReply

A workspace for handling marketplace reviews, buyer questions and messages. MPReply brings supported conversations into one inbox, prepares replies with AI and helps send them automatically or after human review, according to team rules.

[Open MPReply](https://mpreply.ru/en) · [Workspace](https://app.mpreply.ru) · [View demo](https://mpreply.ru/en/demo) · [Русский интерфейс](https://mpreply.ru)

![MPReply homepage showing the shared inbox and reply preparation workflow](docs/images/mpreply-home.jpg)

## The problem it solves

Sellers and marketplace managers switch between seller accounts, look up product information and answer similar questions throughout the day. As the queue grows, it becomes easier to miss an unanswered question or overlook a case that needs a colleague's attention.

MPReply brings this work together: each conversation has product context and a draft reply close at hand. Routine cases can follow automation rules, while cases that need attention stay with a person for review. The team can see each conversation's status and history.

## Features

| Task | What you can do |
| --- | --- |
| Triage incoming conversations | Use a shared inbox and filter by marketplace, conversation type and status. |
| Prepare a reply | Get an AI draft based on the conversation, product and team settings; edit it before sending. |
| Review a difficult case | Open the review queue, examine the context and decide how to respond. |
| Set up automation | Choose which conversations can be handled automatically and which require review. |
| Access control | Keep viewing and reply actions within each workspace member’s permissions. |
| Follow the outcome | View reply history, processing status and conversation analytics. |

The product includes integrations for four marketplaces. Available conversation types depend on the platform and the permissions of the connected seller account.

| Marketplace | Conversations |
| --- | --- |
| Wildberries | Reviews and buyer questions |
| Ozon | Reviews and buyer questions |
| Yandex Market | Product reviews and buyer questions |
| Avito | Chats and supported reviews |

## Try it

1. Open the [demo](https://mpreply.ru/en/demo) to see the workflow from an incoming conversation to a draft reply.
2. Go to the [workspace](https://app.mpreply.ru) and create an account.
3. Connect a marketplace seller account and configure your reply rules.
4. Work through the inbox, review drafts and follow processing results.

For help with setup or using the service, contact [support@mpreply.ru](mailto:support@mpreply.ru).

## Engineering choices

- **A common workflow across marketplaces.** Integrations normalize incoming conversations while preserving each platform's available actions.
- **Separate interface and processing.** The public site and workspace share an API; background jobs load conversations and send replies.
- **Server-side access control.** Data and actions are scoped to an organization and its members' permissions. Marketplace credentials are encrypted at rest and used on the server.
- **Explicit sending states.** Repeated processing accounts for actions already completed. Errors and uncertain outcomes remain distinct from confirmed sends.

## Stack and structure

| Project area | Technologies | Source |
| --- | --- | --- |
| Public site and workspace | TypeScript, React, Next.js | [apps/web](apps/web) |
| API and data | Python, FastAPI, SQLAlchemy, PostgreSQL | [apps/api](apps/api) |
| Background jobs | Python, Dramatiq, Redis | [apps/api/app/workers](apps/api/app/workers) |
| Product and architecture decisions | Markdown | [docs](docs) |

The project uses Docker for containerization and GitHub Actions for automated checks. Dependency versions are recorded in the corresponding applications' dependency files.

## Quality checks

pytest and Vitest cover server logic and interface behavior. PostgreSQL integration checks exercise data operations and concurrent processing. Playwright covers user flows, accessibility and visual checks.

The automated suite also includes type checking, linters, builds, HTML/CSS validation, Lighthouse and container image checks. Configuration and run results are available in [GitHub Actions](https://github.com/fedorovich-web/mpreply/actions).

## Author and code use

A project by [fedorovich-web](https://github.com/fedorovich-web).

The source is provided for reviewing the implementation. No license for unrestricted use or redistribution is granted; reuse requires the author's permission.
