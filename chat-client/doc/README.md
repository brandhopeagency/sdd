# Software Requirements Specification (SRS)

## Dialogflow CX Client Application (Mental Health First Responder)

| Field       | Value                     |
|-------------|---------------------------|
| Version     | 2.2                       |
| Status      | Draft                     |
| Date        | 2024-11-29                |
| Technology  | React 18+ / TypeScript / Vite |

---

## Table of Contents

| # | Section | File |
|---|---------|------|
| 1 | [Introduction](#1-introduction) | This file |
| 2 | [User Personas & RBAC Model](./01-rbac.md) | `01-rbac.md` |
| 3 | [Requirement ID Convention](#2-requirement-id-convention) | This file |
| 4 | [Client Application Requirements](./02-client-app.md) | `02-client-app.md` |
| 5 | [Workbench Module](./03-workbench.md) | `03-workbench.md` |
| 6 | [Data Privacy & GDPR](./04-privacy.md) | `04-privacy.md` |
| 7 | [Wireframes & Screen Layouts](./05-wireframes.md) | `05-wireframes.md` |
| 8 | [Navigation & Routing Logic](./06-navigation.md) | `06-navigation.md` |
| 9 | [Data Models & API Contracts](./07-data-models.md) | `07-data-models.md` |
| 10 | [Non-Functional Requirements](./08-nfr.md) | `08-nfr.md` |
| A | [Appendix (Glossary & Revision History)](./09-appendix.md) | `09-appendix.md` |

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete software requirements for a client-side chat application serving as the primary interface for a Mental Health AI agent powered by Dialogflow CX. The application provides both a user-facing chat interface and an administrative Workbench for research, moderation, and compliance operations.

### 1.2 Scope

This specification covers:

- **Client Chat Interface**: The primary user-facing application for mental health support conversations
- **Administrative Workbench**: A dedicated module for administration, research, data labeling (RLHF), and privacy management (GDPR)
- **Role-Based Access Control (RBAC)**: Permission system governing feature access across user types

### 1.3 Document Conventions

| Convention | Meaning |
|------------|---------|
| **REQ-XXX-NNN** | Formal requirement identifier |
| `code` | Technical terms, code snippets, commands |
| *italic* | Emphasis or new terms |
| [Link] | Cross-reference to another section |

### 1.4 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        End Users                                │
│   (Help Seekers, QA Specialists, Researchers, Moderators)       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React SPA Client                             │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │    Chat Interface    │  │         Workbench                │ │
│  │  - Welcome Screen    │  │  - User Management               │ │
│  │  - Chat Window       │  │  - Research & Moderation         │ │
│  │  - Feedback Controls │  │  - Privacy Controls              │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS/WSS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                           │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Dialogflow CX   │  │  Auth API    │  │  Workbench API   │   │
│  │  (Conversation)  │  │  (Identity)  │  │  (Admin Data)    │   │
│  └──────────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 18.x |
| Language | TypeScript | 5.x |
| Build Tool | Vite | 5.x |
| State Management | Zustand or React Context | Latest |
| Styling | CSS Modules / Tailwind CSS | Latest |
| HTTP Client | Axios or Fetch API | Latest |
| Markdown | react-markdown | Latest |
| Testing | Vitest + React Testing Library | Latest |

---

## 2. Requirement ID Convention

All requirements follow the pattern: `REQ-[CATEGORY]-[NNN]`

| Category   | Code  | Range   | Description                |
|------------|-------|---------|----------------------------|
| Auth       | AUTH  | 001-099 | Authentication & Welcome   |
| UI         | UI    | 100-199 | User Interface Components  |
| Session    | SESS  | 200-299 | Session & State Management |
| Advanced   | ADV   | 300-399 | Debug/Advanced Features    |
| UX         | UX    | 400-499 | Accessibility & Design     |
| Admin      | ADMIN | 500-599 | Workbench Architecture     |
| User Mgmt  | USER  | 600-699 | User Management Module     |
| Research   | DATA  | 700-799 | Research & Moderation      |
| Privacy    | PRIV  | 800-899 | GDPR & Data Privacy        |

---

## Quick Links

- **[User Personas & Permissions →](./01-rbac.md)**
- **[Client App Requirements →](./02-client-app.md)**
- **[Workbench Module →](./03-workbench.md)**
- **[Privacy & GDPR →](./04-privacy.md)**
- **[Wireframes →](./05-wireframes.md)**
- **[Navigation & Routing →](./06-navigation.md)**
- **[Data Models & API →](./07-data-models.md)**
- **[Non-Functional Requirements →](./08-nfr.md)**
- **[Appendix →](./09-appendix.md)**

