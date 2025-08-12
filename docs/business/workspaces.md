# Business Logic: Retrieving and Displaying Notion Workspaces for a User

## Overview

This document describes the business logic for fetching the **Notion Workspaces** that belong to a specific user and displaying them in the application.

The logic is derived from the database schema provided, which includes the following key entities:

- **users**
- **workspaces**
- **workspace_users**
- **notion_oauth**
- **notion_oauth_users**
- **notion_dbs**

---

## Entities and Relationships

### 1. `users`

- Represents application users.
- Key field: `id`

### 2. `workspace_users`

- Junction table linking users to workspaces.
- Fields:
  - `notion_workspace_id` → links to `workspaces.id`
  - `user_id` → links to `users.id`
- Defines which users have access to which workspaces.

### 3. `workspaces`

- Represents Notion workspaces.
- Fields:
  - `id` (PK)
  - `notion_workspace_id` (UUID from Notion API)
  - `bot_id` (UUID of bot integration)
  - `name` (workspace display name)
  - `icon` (workspace icon URL or emoji)
  - `owner` (JSON object with owner info)
  - `duplicated_template_id` (nullable; indicates if workspace was created from a template)
  - `request_id` (internal tracking UUID)
- Each workspace can be connected to a `notion_oauth` record via `workspace_id`.

### 4. `notion_oauth`

- Represents OAuth authentication tokens for connecting to Notion.
- Fields:
  - `id` (PK)
  - `access_token`
  - `token_type`
  - `workspace_id` → references `workspaces.id`

### 5. `notion_oauth_users`

- Maps users to specific `notion_oauth` records.
- Fields:
  - `user_id` → links to `users.id`
  - `notion_oauth_record_id` → links to `notion_oauth.id`

---

## Business Logic Flow

### Step 1: Identify the Authenticated User

- Obtain the **authenticated user's ID** (`user.id`) from the session or JWT.
- This ID will be used to filter workspaces.

### Step 2: Get Workspace IDs Accessible to the User

- Query `workspace_users` to find all records where `user_id` matches the authenticated user.
- Collect all `notion_workspace_id` values (which match `workspaces.id`).
