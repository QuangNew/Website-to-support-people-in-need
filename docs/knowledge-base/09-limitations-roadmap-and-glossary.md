# ReliefConnect Knowledge Base: Limitations, Roadmap, and Glossary

> Last synchronized: 2026-04-16
> Scope: current gaps, archived design directions, glossary aliases, and emergency contact information.
> Retrieval note: this file keeps limitations and roadmap context separate from active product behavior so search results stay more precise.

## 1. Known Limitations and Current Gaps

ReliefConnect has several known gaps that should be documented for users, maintainers, and embedding pipelines:

- Volunteer task completion, ownership tracking, and history are incomplete.
- Sponsor help offers are notification-based today and do not yet expose full persisted offer history.
- Refresh-token rotation is not implemented; long-lived JWTs remain valid until their `exp` unless the user's security stamp is rotated by an admin action.
- No automatic token refresh — users must log in again after token expiry.
- Public OSRM routing can reveal location metadata.
- Supabase pooled connections can complicate EF migrations and Hangfire distributed locks.
- Some repository documents describe advanced chatbot architectures that are not active in runtime.

## 2. Archived n8n and Dify RAG Direction

The repository contains detailed design material for a future chatbot architecture based on:

- n8n as the primary AI workflow engine,
- Dify Knowledge Base for retrieval-augmented generation,
- hybrid search using semantic and keyword weighting,
- model routing between simple and complex queries,
- source citation support in chatbot replies.

This direction is currently a design and documentation asset, not the active production path.

## 3. Other Roadmap Themes in Repository Planning

Planning material in the repository also explores future areas such as:

- donation and campaign systems,
- verification and trust badges,
- mobile UX improvements,
- disaster reporting,
- support station networks,
- richer communication tools,
- impact dashboards and transparency reporting.

These ideas are valuable for knowledge retrieval and roadmap search, but they should be treated as planned or archived concepts unless supported by current runtime code.

## 4. Glossary and Search Aliases

The glossary below is intentionally bilingual and retrieval-friendly.

- `ReliefConnect`: humanitarian aid platform, relief coordination platform, website to support people in need.
- `SOS`: emergency relief request, urgent help request, cứu trợ khẩn cấp.
- `Ping`: map marker, SOS object, relief request record.
- `Person in Need`: affected user, beneficiary, người cần trợ giúp, người cần hỗ trợ.
- `Volunteer`: field helper, responder, tình nguyện viên.
- `Sponsor`: donor, supporter, nhà tài trợ.
- `Zone`: priority zone, risk zone, vùng ưu tiên.
- `Supply Item`: warehouse item, supply point, điểm vật tư.
- `Verification`: KYC-like role approval, xác minh vai trò.
- `System Announcement`: admin broadcast, thông báo hệ thống.
- `System Log`: audit log, nhật ký hệ thống.
- `Verification Status`: none, pending, verified, rejected.
- `Reaction`: like, love, pray, phản ứng.
- `User Wall`: personal feed, timeline, tường cá nhân.
- `Verified Safe`: safety confirmed, xác nhận an toàn.

## 5. Contact and Emergency Information

The frontend guide content names a support contact and local emergency numbers that are part of the user-facing experience.

- Support email: `support@reliefconnect.vn`
- Police: `113`
- Fire and rescue: `114`
- Emergency medical: `115`

These emergency numbers are especially important in chatbot safety responses and user guidance content.