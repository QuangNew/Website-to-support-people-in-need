# ReliefConnect Knowledge Base: Social Feed and AI Chatbot Guide

> Last synchronized: 2026-04-16
> Scope: social feed purpose, post model, reactions and comments, chatbot behavior, multimodal input, and AI provider status.
> Retrieval note: this file combines the two main communication surfaces so content discovery and assistant-related queries can be embedded together.

## 1. Purpose of the Social Feed

The social feed is a humanitarian community feed rather than a general-purpose social network. Its purpose is to help people tell their stories, attract help, and let supporters react and comment.

## 2. Post Categories

ReliefConnect uses three core social categories:

- `Livelihood`: hardship, housing loss, family crisis, employment loss.
- `Medical`: illness, medical emergency, medical cost, treatment support.
- `Education`: tuition support, school supplies, educational barriers.

## 3. Creating a Post

Authenticated users can create a post with content, category, and optional image URL. The backend sanitizes post content before storing it. Image upload currently supports local upload to `wwwroot/uploads` with JPG, PNG, and WebP validation and a 5 MB limit.

## 4. Reactions and Comments

The platform supports three reaction types: `Like`, `Love`, and `Pray`. Reactions are toggle-based. Comments are also sanitized before storage. The feed supports cursor-based pagination to keep scrolling efficient.

## 5. User Wall

The user wall endpoint returns the post history for a specific user. This supports a personal timeline or “My Wall” experience.

## 6. Reporting Content

The broader project documentation and moderation layer treat reports as a way to flag inappropriate content for review. Administrative moderation endpoints support listing reports and reviewing or dismissing them.

## 7. What the AI Chatbot Does

The AI chatbot is a ReliefConnect assistant for first-aid guidance, survival guidance, platform help, and high-level support information. The frontend guide says the chatbot can answer in both Vietnamese and English.

## 8. Chatbot Conversation Model

The chatbot uses a `Conversation` entity and a `Message` entity. A user first creates a conversation, then posts messages to that conversation. The backend retrieves the most recent 20 messages as conversational context before generating a new answer.

## 9. Image Support

The chatbot supports multimodal input. The API accepts optional `ImageBase64` and `ImageMimeType` fields. Both fields must be present together or absent together. The backend decodes the base64 input and rejects images larger than 4 MB in binary form.

## 10. Chatbot Safety Behavior

The chatbot stores whether a generated reply has a safety warning. Emergency-themed guide text highlights hotline numbers 113, 114, and 115. The code and project docs position the chatbot as helpful, but not a substitute for professional emergency or medical response.

## 11. Current AI Provider Status

The current backend implementation uses `IGeminiService` directly through `GeminiService`. The repository also contains extensive documentation and archived plans for a future dual-provider design using n8n and Dify-based retrieval, but that RAG workflow is not the active runtime path today.

## 12. Social and Chatbot Safety Summary

Social content and chatbot messages both pass through content safety measures such as HTML sanitization and media validation. These protections reduce XSS risk, constrain image uploads, and keep user-generated content closer to platform policy expectations.