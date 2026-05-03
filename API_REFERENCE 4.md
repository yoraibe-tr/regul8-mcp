# Regul8 AI — External API Reference

> **Version:** 3.0
> **Last Updated:** 2026-04-09

---

## 0. Prerequisites — Environment Variables

Before using any endpoint or code example in this document, set the following environment variables. Every example references these directly, so once set, all snippets are copy-pasteable without modification.

```bash
export REGUL8_APP_ID="<your-base44-app-id>"             # Base44 application ID
export REGUL8_APP_BASE_URL="<your-app-base-url>"        # App function endpoint root (e.g. https://<app-slug>.base44.app)
export REGUL8_USER_EMAIL="<your-email>"                 # Registered Regul8 user email
export REGUL8_USER_PASSWORD="<your-password>"           # That user's password
```

| Variable | Description | Notes |
|---|---|---|
| `REGUL8_APP_ID` | The Base44 application identifier. | Must be pre-configured before agent execution. |
| `REGUL8_APP_BASE_URL` | Root URL for Function API calls. Format: `https://<app-slug>.base44.app` | Must be pre-configured before agent execution. |
| `REGUL8_USER_EMAIL` | Email address of a registered Regul8 user account. | Must be pre-configured before agent execution. |
| `REGUL8_USER_PASSWORD` | Password for the above user account. | Must be pre-configured before agent execution. |
| `REGUL8_ACCESS_TOKEN` | JWT Bearer token (derived — obtained via login). | Set after authenticating in [Section 2](#2-authentication). Only needed for curl; the SDK manages this automatically. |

### SDK Installation (for JavaScript / Node.js examples)

```bash
npm install @base44/sdk
```

---

## 1. Quick Start for Autonomous Agents

A step-by-step checklist for an LLM or automation agent to integrate end-to-end:

### One-Time Setup

1. **Set environment variables** — Export all four variables from [Section 0](#0-prerequisites--environment-variables).
2. **Install SDK** — `npm install @base44/sdk`

### Periodic Setup (refresh as needed)

3. **Obtain an access token** — Authenticate via SDK or curl ([Section 2](#2-authentication)). The JWT is valid for ~3 months. Re-authenticate only when it expires (HTTP 401).
4. **Fetch reference data** — List Channels, Regulations, Countries, and Products to collect entity IDs ([Section 4](#4-reference-data-endpoints-entity-api)). These change infrequently — cache and refresh every 1–24 hours.

### Per-Submission Flow (repeat for each content batch)

5. **Build submission payload** — Select IDs from step 4 and compose content per channel structure ([Section 5](#5-channel-content-structures)).
6. **Submit content** — Call `processBulkSubmissions` with the payload ([Section 6](#6-content-submission-endpoint)).
7. **Parse results** — Read `results[].is_compliant`, `ai_response`, and check the `failed` array ([Section 7](#7-response-format)).

### Script: Fetch Reference Data (run once, cache the output)

```js
import { createClient } from "@base44/sdk";

const base44 = createClient({ appId: process.env.REGUL8_APP_ID });
await base44.auth.loginViaEmailPassword(
  process.env.REGUL8_USER_EMAIL,
  process.env.REGUL8_USER_PASSWORD
);

const channels = await base44.entities.Channel.list();
const regulations = await base44.entities.Regulation.list();
const countries = await base44.entities.Country.list();
const products = await base44.entities.Product.list();

console.log("Channels:", JSON.stringify(channels, null, 2));
console.log("Regulations:", JSON.stringify(regulations, null, 2));
console.log("Countries:", JSON.stringify(countries, null, 2));
console.log("Products:", JSON.stringify(products, null, 2));
```

### Script: Submit Content for Compliance Analysis

```js
import { createClient } from "@base44/sdk";

const base44 = createClient({ appId: process.env.REGUL8_APP_ID });
await base44.auth.loginViaEmailPassword(
  process.env.REGUL8_USER_EMAIL,
  process.env.REGUL8_USER_PASSWORD
);

const result = await base44.functions.invoke("processBulkSubmissions", {
  submissionData: {
    channel_id: "<channel-id>",
    regulation_ids: ["<regulation-id>"],
    country_ids: [],
    product_ids: [],
    analysis_tool: "azure_openai",
    content_type: "full_ad",
    items: [
      {
        postCopy: "Start trading with zero commission!",
        headline: "Zero Commission Trading",
        description: "Open your account today."
      }
    ]
  }
});

console.log("Compliant:", result.results[0]?.is_compliant);
console.log("AI reason:", result.results[0]?.ai_response?.reason);
```

---

## 2. Authentication

All endpoints (both Entity API and Function API) require a **Bearer token** in the `Authorization` header.

### Header Format

```
Authorization: Bearer <ACCESS_TOKEN>
```

The token is a JWT issued to an authenticated user of the application. The same token works for both entity endpoints and function endpoints. Tokens are valid for approximately **3 months** — store and reuse until you receive a `401 Unauthorized` response, then re-authenticate.

### Obtaining a Token

#### Via Base44 SDK (JavaScript / Node.js)

```js
import { createClient } from "@base44/sdk";

const base44 = createClient({ appId: process.env.REGUL8_APP_ID });
const { access_token, user } = await base44.auth.loginViaEmailPassword(
  process.env.REGUL8_USER_EMAIL,
  process.env.REGUL8_USER_PASSWORD
);
// access_token is now set automatically on the client for subsequent SDK calls.
// Use it as Bearer token for any raw HTTP requests.
console.log("Token:", access_token);
console.log("User:", user.email, user.app_role);
```

After calling `loginViaEmailPassword`, the SDK client automatically attaches the token to all subsequent SDK calls (`entities.*`, `functions.*`, etc.). No manual header management needed when using the SDK.

#### Via curl (bash)

```bash
curl --location "https://app.base44.com/api/apps/${REGUL8_APP_ID}/auth/login" \
  --header 'Content-Type: application/json' \
  --data-raw "{\"email\": \"${REGUL8_USER_EMAIL}\", \"password\": \"${REGUL8_USER_PASSWORD}\"}"
```

**Response:**

```json
{
  "access_token": "<jwt-token>",
  "user": {
    "id": "...",
    "email": "...",
    "app_role": "..."
  }
}
```

Store the returned `access_token` and pass it as `Authorization: Bearer <access_token>` in all subsequent curl requests:

```bash
export REGUL8_ACCESS_TOKEN="<value from response>"
```

### Authentication Failure Response

```json
{
  "error": "Unauthorized"
}
```

**Status Code:** `401 Unauthorized`

---

## 3. Overview

The Regul8 AI API provides programmatic access to the compliance analysis platform. It allows external systems to:

- **Discover** available channels, countries, products, and regulations via standard entity REST endpoints.
- **Submit** marketing content for AI-powered compliance analysis via the `processBulkSubmissions` function.

### Architecture

There are **two types of endpoints** and **two access methods** (SDK or HTTP):

| Type | HTTP Base URL | SDK Method | Auth | Purpose |
|---|---|---|---|---|
| **Entity API** (REST) | `https://app.base44.com/api/apps/{REGUL8_APP_ID}/entities/{EntityName}` | `base44.entities.<EntityName>.list()` | Bearer token | Read reference data (channels, regulations, countries, products) |
| **Function API** | `{REGUL8_APP_BASE_URL}/functions/{functionName}` | `base44.functions.invoke(name, data)` | Bearer token | Submit content for compliance analysis |

### Key Concepts

| Concept | Description |
|---|---|
| **Channel** | A marketing distribution channel (e.g., "Google Ad", "Email", "Facebook"). Each channel has an internal `id` and a defined content structure. |
| **Regulation** | A regulatory framework (e.g., "FCA", "CySEC") that defines compliance rules. |
| **Country** | A country entity with associated regulations. Countries are linked to regulations — only valid country-regulation combinations are processed. |
| **Product** | A financial product that may have country-specific eligibility and marketability restrictions. |
| **Submission** | A persisted compliance analysis record, created when content is submitted for review. |

---

## 4. Reference Data Endpoints (Entity API)

Use these endpoints to discover entity IDs needed for the submission endpoint.

### HTTP Access

**Base URL Pattern:**
```
GET https://app.base44.com/api/apps/{REGUL8_APP_ID}/entities/{EntityName}
```

**Required Headers:**
```
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

### SDK Access

After authenticating (see [Section 2](#2-authentication)), call:
```js
const records = await base44.entities.<EntityName>.list();
```

**Response Format:** All entity endpoints return an array of entity records, each containing an `id` field plus entity-specific data fields.

---

### 4.1 List Channels

Returns all channels. Use the `id` field as `channel_id` in submissions.

#### SDK

```js
const channels = await base44.entities.Channel.list();
```

#### curl

```bash
curl --location "https://app.base44.com/api/apps/${REGUL8_APP_ID}/entities/Channel" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}"
```

#### Example Response

```json
[
  {
    "id": "69c2b92e9e9fcef2f734e82e",
    "name": "Google Ad",
    "is_active": true,
    "created_date": "2026-03-21T10:00:00.000Z"
  },
  {
    "id": "69c2b92e9e9fcef2f734e82d",
    "name": "Email",
    "is_active": true,
    "created_date": "2026-03-21T10:00:00.000Z"
  },
  {
    "id": "69c2b92e9e9fcef2f734e82c",
    "name": "Facebook",
    "is_active": true,
    "created_date": "2026-03-21T10:00:00.000Z"
  }
]
```

#### Key Fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | **Use this as `channel_id` in the submission payload.** |
| `name` | `string` | Human-readable display name (e.g., `"Google Ad"`, `"Email"`). |
| `is_active` | `boolean` | Whether the channel is currently active. |

---

### 4.2 List Regulations

Returns all regulations. Use the `id` field in the `regulation_ids` array in submissions.

#### SDK

```js
const regulations = await base44.entities.Regulation.list();
```

#### curl

```bash
curl --location "https://app.base44.com/api/apps/${REGUL8_APP_ID}/entities/Regulation" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}"
```

#### Example Response

```json
[
  {
    "id": "69c2b90acd9a265d70ed82f9",
    "name": "FCA",
    "description": "Financial Conduct Authority (UK)",
    "created_date": "2026-03-21T10:00:00.000Z"
  },
  {
    "id": "69c2b90acd9a265d70ed82fa",
    "name": "CySEC",
    "description": "Cyprus Securities and Exchange Commission",
    "created_date": "2026-03-21T10:00:00.000Z"
  }
]
```

#### Key Fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | **Use this in `regulation_ids` array in the submission payload.** |
| `name` | `string` | Regulation name (e.g., `"FCA"`, `"CySEC"`). |
| `description` | `string` | Detailed description. |

---

### 4.3 List Countries

Returns all countries. Use the `id` field in the `country_ids` array in submissions.

#### SDK

```js
const countries = await base44.entities.Country.list();
```

#### curl

```bash
curl --location "https://app.base44.com/api/apps/${REGUL8_APP_ID}/entities/Country" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}"
```

#### Example Response

```json
[
  {
    "id": "69c2b92e9e9fcef2f734e801",
    "name": "United Kingdom",
    "code": "uk",
    "country_id": "GB",
    "region": "Rest of Europe",
    "regulations": ["69c2b90acd9a265d70ed82f9"],
    "created_date": "2026-03-21T10:00:00.000Z"
  },
  {
    "id": "69c2b92e9e9fcef2f734e802",
    "name": "Germany",
    "code": "de",
    "country_id": "DE",
    "region": "European Union",
    "regulations": ["69c2b90acd9a265d70ed82fa"],
    "created_date": "2026-03-21T10:00:00.000Z"
  }
]
```

#### Key Fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | **Use this in `country_ids` array in the submission payload.** |
| `name` | `string` | Full country name. |
| `code` | `string` | Short country code (e.g., `"uk"`, `"de"`). |
| `regulations` | `string[]` | Array of regulation IDs this country is linked to. **Important:** Only countries linked to the selected regulation will produce valid analyses. |

---

### 4.4 List Products

Returns all products. Use the `id` field in the `product_ids` array in submissions.

#### SDK

```js
const products = await base44.entities.Product.list();
```

#### curl

```bash
curl --location "https://app.base44.com/api/apps/${REGUL8_APP_ID}/entities/Product" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}"
```

#### Example Response

```json
[
  {
    "id": "69c2b92e9e9fcef2f734e810",
    "name": "CFDs",
    "description": "Contracts for Difference",
    "is_active": true,
    "created_date": "2026-03-21T10:00:00.000Z"
  }
]
```

#### Key Fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | **Use this in `product_ids` array in the submission payload.** |
| `name` | `string` | Product name. |
| `is_active` | `boolean` | Whether the product is active. |

---

## 5. Channel Content Structures

Each channel expects specific fields in the `items` array of the submission payload. Below is the content structure for every supported channel.

> **Key:** Fields marked with **(required)** must be present and non-empty. All other fields are optional.

---

### Google Ad

**Content type:** `headline`, `description1`, or `description2` (must match the single non-null field)

> **Important:** The API currently supports checking **one part of a Google Ad at a time**, not a full ad. Submit exactly one non-null field and set `content_type` to match that field. The other two fields should be `null`.

| Field | Description |
|---|---|
| `headline` | Ad headline (max 30 characters per line) |
| `description1` | First description line (max 90 characters) |
| `description2` | Second description line (max 90 characters) |

**Example — checking a headline:**
```json
{
  "headline": "Trade Smarter Today",
  "description1": null,
  "description2": null
}
```
With `"content_type": "headline"`.

**Example — checking description1:**
```json
{
  "headline": null,
  "description1": "Low fees and high returns. Capital at risk.",
  "description2": null
}
```
With `"content_type": "description1"`.

---

### Email

**Content type:** `full_ad`

| Field | Description |
|---|---|
| `subject` **(required)** | The email subject line (recommended 25–60 characters) |
| `preheader` | Preview text shown after subject (recommended 40–100 characters) |
| `body` **(required)** | Main email body content (no character limit) |

```json
{
  "subject": "Exclusive Trading Offer",
  "preheader": "Limited time only",
  "body": "Dear customer, we are excited to offer you exclusive access to our premium trading tools."
}
```

---

### Facebook

**Content type:** `full_ad`

| Field | Description |
|---|---|
| `postCopy` **(required)** | Main post text (recommended ≤125 characters) |
| `headline` | Ad headline (recommended ≤40 characters) |
| `description` | Ad description (recommended ≤30 characters) |

```json
{
  "postCopy": "Start trading with zero commission!",
  "headline": "Zero Commission Trading",
  "description": "Open your account today."
}
```

---

### X (Twitter)

**Content type:** `full_ad`

| Field | Description |
|---|---|
| `postCopy` **(required)** | Tweet text (max 280 characters) |

```json
{
  "postCopy": "Breaking news! New trading features available. #Trading #Finance"
}
```

---

### Taboola

**Content type:** `full_ad`

| Field | Description |
|---|---|
| `headline` **(required)** | Ad headline (recommended ≤80 characters) |
| `description` | Ad description (recommended ≤200 characters) |

```json
{
  "headline": "You won't believe this trading opportunity!",
  "description": "Click to discover more about our platform."
}
```

---

## 6. Content Submission Endpoint

### 6.1 `processBulkSubmissions`

This is the **primary endpoint** for submitting content for compliance analysis. It accepts one or more content items and runs each through the AI compliance engine against every valid regulation-country combination.

#### SDK Method

```js
const result = await base44.functions.invoke("processBulkSubmissions", {
  submissionData: {
    channel_id: "<channel-id>",
    regulation_ids: ["<regulation-id>"],
    country_ids: [],
    product_ids: [],
    analysis_tool: "azure_openai",
    content_type: "full_ad",
    items: [
      { /* channel-specific fields */ }
    ]
  }
});
```

#### HTTP Method & Path

```
POST {REGUL8_APP_BASE_URL}/functions/processBulkSubmissions
```

#### Request Headers

| Header | Required | Value |
|---|---|---|
| `Content-Type` | Yes | `application/json` |
| `Authorization` | Yes | `Bearer <ACCESS_TOKEN>` |

#### Request Payload Schema

```json
{
  "submissionData": {
    "channel_id": "<string>",
    "regulation_ids": ["<string>"],
    "country_ids": ["<string>"],
    "product_ids": ["<string>"],
    "analysis_tool": "<string>",
    "content_type": "<string>",
    "items": [
      { "<field>": "<value>" }
    ]
  }
}
```

#### Field Reference

| Field | Type | Required | Description | Allowed / Recommended Values |
|---|---|---|---|---|
| `submissionData` | `object` | **Yes** | Top-level wrapper object containing all submission parameters. | — |
| `submissionData.channel_id` | `string` | **Yes** | The internal ID of the marketing channel to validate against. Determines which compliance rules, prompts, and disclaimer mappings are used. Fetch available IDs from the [Channel endpoint](#41-list-channels). | Any `id` returned by the Channel entity endpoint. |
| `submissionData.regulation_ids` | `string[]` | **Yes** | One or more regulation IDs to check compliance against. Each regulation-country combination produces a separate analysis. Fetch available IDs from the [Regulation endpoint](#42-list-regulations). | Any `id`(s) returned by the Regulation entity endpoint. At least one is required. |
| `submissionData.country_ids` | `string[]` | No | Country IDs to scope the analysis to. When provided, only compliance rules applicable to these countries are applied, and a per-country compliance breakdown is returned. Countries must be linked to the selected regulation(s) — unlinked countries are silently skipped. Fetch available IDs from the [Country endpoint](#43-list-countries). | Any `id`(s) returned by the Country entity endpoint. Pass `[]` or omit to run without country scoping. |
| `submissionData.product_ids` | `string[]` | No | Product IDs referenced by the submitted content. Used for: (1) product eligibility checks per country, (2) disclaimer selection logic, and (3) providing product context to the AI. Fetch available IDs from the [Product endpoint](#44-list-products). | Any `id`(s) returned by the Product entity endpoint. Pass `[]` or omit if not applicable. |
| `submissionData.analysis_tool` | `string` | No | Selects which AI engine performs the compliance analysis. | `"azure_openai"` (default, recommended), `"openai"`, `"base44"`. |
| `submissionData.content_type` | `string` | **Yes** | Tells the AI engine what type of content it is analyzing. This affects which compliance rules, disclaimer mappings, and historical examples are loaded. **Must match the channel.** | **Google Ads:** `"headline"`, `"description1"`, or `"description2"` (must correspond to the single non-null field in items — see [Google Ad structure](#google-ad)). **All other channels:** `"full_ad"`. |
| `submissionData.items` | `array` | **Yes** | Array of content objects to analyze. Each object represents one piece of content. The keys inside each object must match the field names defined in [Channel Content Structures](#5-channel-content-structures) for the selected channel. Multiple items can be submitted in one request — each is analyzed independently. | See [Section 5](#5-channel-content-structures) for the exact fields per channel. |

> **Note:** Each item is analyzed separately against every valid regulation-country combination. For example, 3 items × 2 regulations × 4 countries = 24 individual analyses.

---

#### Example — Google Ad Headline

**SDK:**

```js
const result = await base44.functions.invoke("processBulkSubmissions", {
  submissionData: {
    channel_id: "<channel-id-for-google-ad>",
    regulation_ids: ["<regulation-id>"],
    country_ids: [],
    product_ids: [],
    analysis_tool: "azure_openai",
    content_type: "headline",
    items: [
      {
        headline: "Trade Smarter Today",
        description1: null,
        description2: null
      }
    ]
  }
});
```

**curl:**

```bash
curl --location "${REGUL8_APP_BASE_URL}/functions/processBulkSubmissions" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}" \
  --data '{
  "submissionData": {
    "channel_id": "<channel-id-for-google-ad>",
    "regulation_ids": ["<regulation-id>"],
    "country_ids": [],
    "product_ids": [],
    "analysis_tool": "azure_openai",
    "content_type": "headline",
    "items": [
      {
        "headline": "Trade Smarter Today",
        "description1": null,
        "description2": null
      }
    ]
  }
}'
```

#### Example — Google Ad (Multiple Headlines)

**SDK:**

```js
const result = await base44.functions.invoke("processBulkSubmissions", {
  submissionData: {
    channel_id: "<channel-id-for-google-ad>",
    regulation_ids: ["<regulation-id>"],
    country_ids: [],
    product_ids: [],
    analysis_tool: "azure_openai",
    content_type: "headline",
    items: [
      { headline: "Trade Smarter Today", description1: null, description2: null },
      { headline: "Invest With Confidence", description1: null, description2: null }
    ]
  }
});
```

**curl:**

```bash
curl --location "${REGUL8_APP_BASE_URL}/functions/processBulkSubmissions" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}" \
  --data '{
  "submissionData": {
    "channel_id": "<channel-id-for-google-ad>",
    "regulation_ids": ["<regulation-id>"],
    "country_ids": [],
    "product_ids": [],
    "analysis_tool": "azure_openai",
    "content_type": "headline",
    "items": [
      {
        "headline": "Trade Smarter Today",
        "description1": null,
        "description2": null
      },
      {
        "headline": "Invest With Confidence",
        "description1": null,
        "description2": null
      }
    ]
  }
}'
```

#### Example — Facebook

**SDK:**

```js
const result = await base44.functions.invoke("processBulkSubmissions", {
  submissionData: {
    channel_id: "<channel-id-for-facebook>",
    regulation_ids: ["<regulation-id>"],
    country_ids: [],
    product_ids: [],
    analysis_tool: "azure_openai",
    content_type: "full_ad",
    items: [
      {
        postCopy: "Start trading with zero commission!",
        headline: "Zero Commission Trading",
        description: "Open your account today."
      }
    ]
  }
});
```

**curl:**

```bash
curl --location "${REGUL8_APP_BASE_URL}/functions/processBulkSubmissions" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}" \
  --data '{
  "submissionData": {
    "channel_id": "<channel-id-for-facebook>",
    "regulation_ids": ["<regulation-id>"],
    "country_ids": [],
    "product_ids": [],
    "analysis_tool": "azure_openai",
    "content_type": "full_ad",
    "items": [
      {
        "postCopy": "Start trading with zero commission!",
        "headline": "Zero Commission Trading",
        "description": "Open your account today."
      }
    ]
  }
}'
```

#### Example — Email

**SDK:**

```js
const result = await base44.functions.invoke("processBulkSubmissions", {
  submissionData: {
    channel_id: "<channel-id-for-email>",
    regulation_ids: ["<regulation-id>"],
    country_ids: [],
    product_ids: [],
    analysis_tool: "azure_openai",
    content_type: "full_ad",
    items: [
      {
        subject: "Exclusive Trading Offer",
        preheader: "Limited time only",
        body: "Dear customer, we are excited to offer you exclusive access to our premium trading tools."
      }
    ]
  }
});
```

**curl:**

```bash
curl --location "${REGUL8_APP_BASE_URL}/functions/processBulkSubmissions" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}" \
  --data '{
  "submissionData": {
    "channel_id": "<channel-id-for-email>",
    "regulation_ids": ["<regulation-id>"],
    "country_ids": [],
    "product_ids": [],
    "analysis_tool": "azure_openai",
    "content_type": "full_ad",
    "items": [
      {
        "subject": "Exclusive Trading Offer",
        "preheader": "Limited time only",
        "body": "Dear customer, we are excited to offer you exclusive access to our premium trading tools."
      }
    ]
  }
}'
```

#### Example — With Countries and Products

**SDK:**

```js
const result = await base44.functions.invoke("processBulkSubmissions", {
  submissionData: {
    channel_id: "<channel-id-for-google-ad>",
    regulation_ids: ["<regulation-id>"],
    country_ids: ["<country-id-1>", "<country-id-2>"],
    product_ids: ["<product-id>"],
    analysis_tool: "azure_openai",
    content_type: "headline",
    items: [
      {
        headline: "Trade CFDs Today",
        description1: null,
        description2: null
      }
    ]
  }
});
```

**curl:**

```bash
curl --location "${REGUL8_APP_BASE_URL}/functions/processBulkSubmissions" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer ${REGUL8_ACCESS_TOKEN}" \
  --data '{
  "submissionData": {
    "channel_id": "<channel-id-for-google-ad>",
    "regulation_ids": ["<regulation-id>"],
    "country_ids": ["<country-id-1>", "<country-id-2>"],
    "product_ids": ["<product-id>"],
    "analysis_tool": "azure_openai",
    "content_type": "headline",
    "items": [
      {
        "headline": "Trade CFDs Today",
        "description1": null,
        "description2": null
      }
    ]
  }
}'
```

---

#### Success Response

```json
{
  "success": true,
  "results": [
    {
      "id": "sub_abc123def456",
      "user_id": "usr_001",
      "user_email": "user@example.com",
      "channel_id": "<channel-id>",
      "regulation_id": "<regulation-id>",
      "countries": [],
      "products": [],
      "is_compliant": false,
      "processing_time_ms": 4523,
      "analysis_tool": "azure_openai",
      "content_type": "full_ad",
      "content": {
        "headline": { "value": "Trade Smarter Today", "length": 19 },
        "description1": { "value": "Low fees and high returns.", "length": 25 },
        "description2": { "value": "Capital at risk. Sign up now.", "length": 29 }
      },
      "ai_response": {
        "is_compliant": false,
        "confidence_score": 0.92,
        "reason": "The headline contains a promotional claim without the required risk disclaimer.",
        "suggested_change": "Trade Smarter Today → Trade Smarter Today. Capital at risk.",
        "rule_violations": [
          {
            "rule_id": "rule_001",
            "rule_title": "Risk Warning Required",
            "violation_reason": "Promotional headline lacks mandatory risk disclaimer.",
            "violating_text": "Trade Smarter Today"
          }
        ],
        "disclaimer_analysis": {
          "is_disclaimer_compliant": false,
          "required_disclaimer": "Capital at risk.",
          "found_disclaimer": ""
        },
        "compliance_audit_trail": [
          { "check_performed": "Structural Analysis", "outcome": "Pass", "details": "Content structure matches expected schema." },
          { "check_performed": "Disclaimer Validation", "outcome": "Fail", "details": "Required disclaimer missing from headline." },
          { "check_performed": "Rule Validation", "outcome": "Fail", "details": "1 rule violation detected." },
          { "check_performed": "Historical Examples Analysis", "outcome": "Pass", "details": "Consistent with known non-compliant patterns." },
          { "check_performed": "Final Compliance Verification", "outcome": "Fail", "details": "Content is non-compliant due to missing disclaimer." }
        ]
      },
      "country_compliance_breakdown": [],
      "applied_rules": ["rule_001", "rule_002"],
      "batch_id": "batch_1712345678_abc123",
      "review_status": "none",
      "created_date": "2026-04-08T14:30:00.000Z"
    }
  ],
  "failed": [],
  "progress": {
    "current": 1,
    "total": 1,
    "compliant": 0,
    "nonCompliant": 1
  }
}
```

#### Response Field Reference

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` if the request was processed (even if some items failed). |
| `results` | `array` | Array of successfully analyzed submission records. |
| `results[].id` | `string` | Unique submission ID. |
| `results[].is_compliant` | `boolean` | Overall compliance verdict. |
| `results[].ai_response` | `object` | Full AI analysis result (see below). |
| `results[].ai_response.confidence_score` | `number` | AI confidence (0.00–1.00). |
| `results[].ai_response.reason` | `string` | Explanation of the compliance verdict. |
| `results[].ai_response.suggested_change` | `string` | Suggested corrections (`previous → new` format). Empty if compliant. |
| `results[].ai_response.rule_violations` | `array` | Array of violated rules. |
| `results[].ai_response.disclaimer_analysis` | `object` | Disclaimer compliance details. |
| `results[].ai_response.compliance_audit_trail` | `array` | Exactly 5 audit steps. |
| `results[].country_compliance_breakdown` | `array` | Per-country compliance results (empty if no countries specified). |
| `results[].content` | `object` | Parsed content with `{ value, length }` for each field. |
| `results[].processing_time_ms` | `number` | Analysis time in milliseconds. |
| `results[].review_status` | `string` | `"none"` or `"pending"` (if automatic review was triggered). |
| `failed` | `array` | Array of items that failed processing, with `content`, `regulation`, and `error` fields. |
| `progress` | `object` | Summary counts: `current`, `total`, `compliant`, `nonCompliant`. |

#### Error Responses

| Status | Error | Cause |
|---|---|---|
| `401` | `"Unauthorized"` | Missing or invalid Bearer token. |
| `400` | `"Missing required parameter: submissionData"` | Request body missing `submissionData`. |
| `400` | `"Missing required parameter: submissionData.channel_id"` | Channel ID not provided. |
| `400` | `"Missing or empty required parameter: submissionData.regulation_ids"` | No regulation IDs provided. |
| `400` | `"Missing or empty required parameter: submissionData.items"` | No content items provided. |
| `400` | `"Missing required parameter: submissionData.content_type"` | Content type not provided. |
| `500` | `"Internal server error during bulk submission processing"` | Unexpected server error. Includes `details` field with error message. |

#### Example Error Response

```json
{
  "success": false,
  "error": "Missing required parameter: submissionData.channel_id"
}
```

---

## 7. Troubleshooting

| Symptom | Likely Cause | Resolution |
|---|---|---|
| HTTP 401 on every request | Token expired or invalid | Re-authenticate using [Section 2](#2-authentication) to obtain a fresh token. |
| `"Channel with ID ... not found"` | Invalid channel ID | Verify the ID by listing channels via `base44.entities.Channel.list()`. |
| `"No compliance rules found"` | Missing rule configuration | Ensure compliance rules exist for the selected regulation + channel + country combination. |
| `"Compliance prompt not found for this channel"` | Missing prompt | Ensure a Prompt record exists for the channel. |
| `"No valid country-regulation combinations found"` | Country not linked to regulation | Check the country's `regulations` array in the Country entity. |
| All items in `failed` array | AI analysis errors | Check the `error` field in each failed item. May indicate model issues or rate limits. |

---

## 8. Best Practices

1. **Use entity IDs directly** — All submission fields accept internal IDs. Fetch them once from entity endpoints and cache.
2. **Match items to channel structure** — Refer to [Channel Content Structures](#5-channel-content-structures) to know which fields each channel expects and which are required.
3. **One regulation per request** — Although multiple regulations are supported (creating separate analyses per regulation-country combo), submitting one at a time simplifies response handling.
4. **Include countries when possible** — Country-specific rules provide more accurate compliance analysis.
5. **Check `failed` array** — Even when `success: true`, some individual items may have failed. Always check the `failed` array.
6. **Idempotency** — Each call creates new Submission records. Avoid retrying successful requests.
7. **Rate Limiting** — Each request invokes AI inference. Avoid excessive concurrent requests; use the `items` array to batch multiple pieces of content in one call.

---

*End of API Reference*
