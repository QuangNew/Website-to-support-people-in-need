# **Software Requirements Specification: Web Application for Connecting Relief Aid to People in Need**

## **1\. Introduction**

### **1.1 Purpose**

The purpose of this document is to define the software requirements for the **"Relief Connection Support Platform"** (Xây dựng Website Hỗ trợ Kết nối Cứu trợ với những người có hoàn cảnh khó khăn). This document describes the functional and non-functional requirements in detail to ensure a unified understanding of the final product among Developers, Project Managers (PM), and Stakeholders (Faculty/Instructors).

### **1.2 Document Conventions**

* **Functional requirements:** Labeled in the format REQ-\[FEATURE\]-\[ID\].  
* **Priorities:** High, Medium, Low.  
* **Bold text:** Used for key terms, feature names, or user roles.  
* **TBD (To Be Determined):** Items requiring further definition during development.

### **1.3 Project Scope**

The system is a **Web Application** designed to connect donors and volunteers with individuals facing difficult circumstances (natural disasters, pandemics, poverty).

Major subsystems include:

* **Interactive Relief Map:** Displays locations in need, provides routing, and issues emergency alerts.  
* **Community Social Hub:** Allows users to share situations, call for community help, and interact.  
* **Automated AI Support:** An integrated Chatbot utilizing the Google Gemini API.

### **1.4 References**

* PBL3-functional-description.txt (Preliminary business description).  
* De\_cuong\_PBL3.pdf (Detailed Syllabus for PBL3 Course \- DUT).  
* PBL\_3\_Application\_Programming\_Project.docx (Technology regulations and reporting standards).  
* **IEEE Std 830-1998** (Recommended Practice for Software Requirements Specifications).

## **2\. Overall Description**

### **2.1 Product Perspective**

This is a new, standalone product developed within the scope of the PBL3 course project. The system operates as a **Client-Server** web architecture. It integrates with third-party services including **OpenStreetMap + Leaflet.js** for mapping functionalities and the **Google Gemini API** for the AI Chatbot.

### **2.2 User Classes and Characteristics**

The system defines user classes based on authentication levels, business roles, and access privileges.

| Actor | Description | Key Privileges |
| :---- | :---- | :---- |
| **Unauthenticated Guest** | Users accessing the system without registration or login. | \- View introduction info. \- View the map in restricted mode (read-only). \- View community posts in read-only mode. |
| **Authenticated Guest** | Users with an account but unverified identity or role. | \- Update personal profile. \- View content for registered users. \- Submit requests for role verification (Person In Need / Sponsor / Volunteer). \- *Restriction:* Cannot post SOS signals or accept tasks. |
| **Person In Need** | Individuals/Households requiring support due to disasters, illness, or hardship. | \- Post and manage SOS requests on the map. \- Share detailed situations on the social network. \- Track support status and community feedback. |
| **Sponsor** | Individuals/Organizations wishing to contribute financial aid, supplies, or indirect support. | \- Search and view details of support cases. \- Track donation history. \- Interact with community posts. |
| **Volunteer** | Individuals participating in direct relief support (transport, field verification, emergency aid). | \- View SOS points and relief routes. \- Accept and confirm support tasks. \- Update field status (Approached / Resolved). |
| **Admin** | System managers/operators (Dev Team). | \- User management and role approval. \- Content moderation for community posts. \- Manage "Priority Zones" and system configuration. \- View logs and system statistics. |

### **2.3 Operating Environment**

* **Client:** Modern Web Browsers (Chrome, Firefox, Edge, Safari) on Desktop and Mobile devices.  
* **Server:**  
  * Application Server: ASP.NET Core (.NET).  
  * Database Server: Supabase.  
* **Network:** Stable Internet connection required for map loading and real-time data; **WebSocket** protocol support required for SOS features.  
* **Performance:** Make sure it’s light and smooth loading.

### **2.4 Design and Implementation Constraints**

* **Programming Language:** C\# (.NET).  
* **Database:** Supabase.  
* **Timeline:** One semester (approx. 15 weeks).  
* **Team Size:** 4 students.  
* **APIs:** OpenStreetMap + Leaflet.js (Mapping), Google Gemini API (Chatbot).

### **2.5 Assumptions and Dependencies**

* OpenStreetMap tiles and Gemini API operate stably, and API usage quotas are sufficient.  
* Users provide truthful information during the verification process (Basic KYC).  
* User devices support GPS (required for Location/Map features).

## **3\. System Features**

### **3.1 Feature 1: Relief Map & Routing System**

**Priority:** High

#### **3.1.1 Description**

Provides a visual digital map displaying relief hotspots, supply warehouses, and shelters. Integrates pathfinding algorithms and priority analysis.

#### **3.1.2 Functional Requirements**

* **REQ-MAP-01 (Marker Visualization):** The system shall display distinct markers differentiated by color/icon:  
  * Person In Need (SOS): Red.  
  * Sponsor: Blue.  
  * Supply Warehouse: Warehouse Icon.  
  * Safe Shelter: House/Shield Icon.  
* **REQ-MAP-02 (Pinning/Posting):** Only **Verified Users** (Person In Need, Sponsor) have the privilege to pin their current location and post details (Needs / Offers) directly on the map. Guests have read-only access.  
* **REQ-MAP-03 (Routing):** The system shall provide turn-by-turn directions from the Volunteer's location to the Person In Need.  
  * *Constraint:* Must propose **at least 02 distinct routes** (e.g., Shortest Distance vs. Safest/Least Congested). The \**A* (A-Star)\*\* algorithm is recommended for pathfinding on a weighted graph (where weights include distance and Safety Factors).  
* **REQ-MAP-04 (AI Priority Analysis):** The system shall automatically analyze and suggest relief priority levels based on:  
  * Disaster/Pandemic Zones (Geofencing).  
  * Urgency level of the post.  
* **REQ-MAP-05 (SOS Visual Alert \- Emergency Mode):** For users located within "Priority Zones" (defined by Admin) who have activated SOS status but have not confirmed safety within 15 minutes:  
  * The system shall render a **blinking effect** on their marker to attract immediate attention.

### **3.2 Feature 2: Community Social Network**

**Priority:** High

#### **3.2.1 Description**

A niche social network for sharing stories, circumstances, and connecting the community.

#### **3.2.2 Functional Requirements**

* **REQ-SOC-01 (Posting & Categorization):** Users can create posts (text, images). The system mandates the selection of a Category:  
  * Livelihood Support (Gia cảnh).  
  * Medical Support (Bệnh tật).  
  * Education Support (Giáo dục).  
* **REQ-SOC-02 (Interaction):** Support for Reactions (Like, Love, Pray, etc.) and Comments.  
* **REQ-SOC-03 (My Wall):** Personal profile page displaying the user's posting history (Personal Timeline).

### **3.3 Feature 3: AI Virtual Assistant (Gemini Chatbot)**

**Priority:** Low (Advanced Feature)

#### **3.3.1 Description**

Integration of an intelligent Virtual Assistant using **Google Gemini API** to automatically answer user queries 24/7. This feature provides first aid knowledge, survival skills, and system usage guides, replacing human support agents.

#### **3.3.2 Functional Requirements**

* **REQ-BOT-01 (Gemini API Integration):**  
  * The system shall interface with the Google Gemini API to process Natural Language (NLP) and generate responses.  
  * The Chatbot shall respond within **\< 5 seconds** for standard queries (subject to API latency).  
* **REQ-BOT-02 (System Prompt & Knowledge Scope):**  
  * The Chatbot is configured (via System Prompt) to act as a "Relief Assistant," focusing on:  
    * **Basic First Aid:** Instructions for treating wounds, drowning, asphyxiation, etc.  
    * **Survival Skills:** Finding water sources, reinforcing houses during storms.  
    * **System Guide:** How to post SOS, locate shelters, verify accounts, etc.  
* **REQ-BOT-03 (Safety Fallback):**  
  * *Logic:* If keywords related to critical medical conditions or life-threatening situations are detected.  
  * *Action:* The Chatbot shall refuse to provide specific medical advice, display a **Red Warning**, and immediately provide emergency numbers (113, 114, 115\) or the nearest medical facility from map data.

## **4\. Data Requirements**

### **4.1 Logical Data Model**

The system manages the following key data entities:

* **User:** UserID (PK), Username, PasswordHash, FullName, Role (Guest, PersonInNeed, Sponsor, Volunteer, Admin), VerificationStatus, CreatedAt.  
* **SocialPost:** PostID (PK), Content, ImageURL, CategoryID, CreatedAt, AuthorID (FK \-\> User).  
* **MapItem:** ItemID (PK), Coordinates (Lat/Long), Type (SOS/Supply/Shelter), Status (Pending, InProgress, Resolved), PriorityLevel, CreatedAt, UserID (FK).  
* **Conversation:** ConversationID (PK), CreatedAt, SenderID (FK \-\> User).  
* **Message:** MessageID (PK), Content, IsBotMessage, SentAt, SenderID (FK \-\> User), ConversationID (FK).

### **4.2 Data Dictionary**

| Data Name | Entity | Data Type (Est.) | Constraints / Description |
| :---- | :---- | :---- | :---- |
| **Username** | User | Varchar(50) | \- Unique. \- No special characters. \- Length: 6-50 chars. |
| **Password** | User | Varchar(255) | \- Stored as Hash (no plain text). \- Min 8 chars, including uppercase, lowercase, and numbers. |
| **Role** | User | Enum / Int | 0: Guest, 1: PersonInNeed, 2: Sponsor, 3: Volunteer, 9: Admin |
| **SOS\_Status** | MapItem | Int | 0: Pending (Waiting for help/approval). 1: InProgress (Volunteer assigned). 2: Resolved (Completed). 3: Verified\_Safe (User confirmed safety). |
| **ImageURL** | SocialPost | Varchar(Max) | \- Allowed formats: .jpg, .png, .jpeg. \- Max upload size: 5MB/image. |

### **4.3 Data Acquisition, Integrity, Retention, and Disposal**

* **Spatial Indexing:** Location data (MapItem) must use spatial indexing (Geography data type in Supabase) to optimize radius-based queries.  
* **Backup:** Daily database backups required.  
* **Security:** Message data must be encrypted/secured; accessible only by conversation participants (or Admin if necessary).

## **5\. External Interface Requirements**

### **5.1 User Interfaces**

* **Dashboard:** Intuitive, responsive design (Mobile/Tablet/Desktop compatible).  
* **Map View:** Optimized map display area with easily accessible controls (Zoom, Filter).  
* **Social Feed:** Timeline layout with **Lazy Loading** mechanism.

### **5.2 Software Interfaces**

* **OpenStreetMap + Leaflet.js:** Used for Map Display and spatial visualization. Routing via OSRM (free).  
* **Google Gemini API:** Generative AI services.  
* **Database Connector:** ADO.NET / Entity Framework (.NET).

### **5.3 Communications Interfaces**

* **HTTPS:** Mandatory for all connections to ensure data security.  
* **WebSocket / SignalR:** Mandatory for supporting REQ-MAP-04 (Real-time blinking SOS alerts) and real-time Volunteer location tracking.

## **6\. Quality Attributes**

### **6.1 Usability**

* General users must be able to complete an SOS post in **maximum 3 steps**.  
* New users must understand map usage within **≤ 2 minutes** without external instruction.

### **6.2 Performance**

* Initial map load time **≤ 3 seconds** on 4G connection.  
* SOS list query time **≤ 2 seconds** with 50 concurrent users.

### **6.3 Security**

* **REQ-SEC-01 (Password Hashing):** User passwords shall not be stored in plain text. The system must use ASP.NET Core Identity with **PBKDF2 / BCrypt** hashing algorithms.  
* **REQ-SEC-02 (SQL Injection Prevention):** All data queries must go through Entity Framework Core (using Parameterized Queries) to prevent SQL Injection.  
* **REQ-SEC-03 (API Security):** API Keys (Gemini) must be hidden Server-side. Map uses OpenStreetMap (no key required).  
* **REQ-SEC-04:** Strict Authentication and Authorization mechanisms between Roles.

### **6.4 Reliability**

* SOS data and geolocation must be accurate.  
* The system must have periodic data backup mechanisms.

## **7\. Internationalization and Localization Requirements**

* The system supports **Vietnamese** as the primary language.  
* Designed to support **Resource Files (.resx)** in .NET to facilitate future multi-language support (English).

## **8\. Other Requirements**

* **Logging:** System logging for critical actions (Login, Posting, Deleting Posts).  
* **Legal Compliance:** Display **Terms of Service** requiring users to commit to the truthfulness of SOS requests.

## **Appendix A: Glossary**

* **SOS:** Emergency relief request.  
* **AI:** Artificial Intelligence.  
* **KYC:** Know Your Customer (Identity Verification Process).  
* **SignalR:** ASP.NET Core library for real-time web functionality.

## **Appendix B: Analysis Models**

*(This section is reserved for Use Case Diagrams and Detailed ERDs to be added in the Design Document).*