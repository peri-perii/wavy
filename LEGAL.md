# Wavy Legal Documentation

Welcome to Wavy, an open-source, non-commercial music streaming and synchronized listening platform. Wavy is built on a philosophy of open source, user autonomy, and maximum privacy. 

This document contains three sections:
1. **Terms of Service (ToS)**
2. **Privacy Policy**
3. **Creative Commons & MIT License Disclosure**

---

## SECTION 1: TERMS of SERVICE (ToS)

*Last Updated: June 14, 2026*

Please read these Terms of Service ("Terms") carefully before using the Wavy platform, website, or services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service.

### 1.1 "As-Is" Service and MIT License Disclaimer
Wavy is an open-source software project. The official hosted instances of Wavy are provided strictly on an **"AS IS"** and **"AS AVAILABLE"** basis, without warranties or conditions of any kind, either express or implied. 

To the maximum extent permitted under applicable law:
* **No Uptime Guarantees:** We do not warrant that the Service will operate uninterrupted, secure, or available at any particular time or location.
* **Liability Limitation:** In no event shall the authors, contributors, or copyright holders of Wavy be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

### 1.2 Third-Party API Consumer Clause (Jamendo Integration)
Wavy does not host, store, upload, distribute, or own any audio files or music media. 
* **Automated Gateway Proxy:** Wavy acts solely as an automated interface, player client, and gateway proxy to the third-party REST API catalog provided by **Jamendo** (https://www.jamendo.com).
* **Intellectual Property Rights:** All rights, titles, and copyrights to the streamable audio tracks remain the sole property of their respective creators and licensors on Jamendo. Wavy asserts no copyright, licensing claims, or ownership over any music played through the platform.
* **Compliance with Jamendo Terms:** By streaming audio through Wavy, you agree to comply with Jamendo’s own End-User Terms of Use and licensing terms. If Jamendo terminates or modifies its API service, Wavy's capability to stream that audio may cease immediately without notice.

### 1.3 Acceptable Use for Jam Rooms
Wavy allows users to create and join synchronized listening rooms ("Jam Rooms") that include real-time text chat and collaborative song queuing. 
* **Host Autonomy:** The creator/host of a Jam Room holds sole discretion and administrative control over their local room environment. Hosts have the right to kick, ban, or restrict participants from their rooms for any reason.
* **Prohibited Content:** When participating in Jam Room chats, you are strictly prohibited from transmitting or posting:
  1. Content that constitutes harassment, abuse, defamation, hate speech, or threats of violence.
  2. Links to illegal material, malware, or pirated content.
  3. Script injection payloads, cross-site scripting (XSS) attempts, or other malicious code designed to disrupt client devices or the Service.
* **Ephemeral/Unmoderated Nature:** While we prohibit the above activities, you acknowledge that Jam Room chats are ephemeral, real-time transmissions that are not actively pre-moderated by the platform developers.

---

## SECTION 2: PRIVACY POLICY

*Last Updated: June 14, 2026*

Wavy is designed with a strict **Principle of Data Minimization**. We believe that the best way to protect your privacy is to never collect your data in the first place.

### 2.1 General Listeners (No-Account Access)
For the general public who use Wavy to browse and listen to music, create ephemeral Jam Rooms, or join existing rooms:
* **Zero Registration Required:** You do not need to register, create an account, or provide any personal identification (such as name, email, or telephone number) to use the platform.
* **No Tracking Cookies:** Wavy does not use tracking cookies, targeting cookies, or third-party marketing beacons. Local browser state (stored via Web Storage) is used strictly to remember your active player volume, interface settings, or current local session token.
* **No Diagnostic Telemetry:** We do not track your listening history, search queries, or behavioral patterns.

### 2.2 Authenticated Users (Supabase Auth - Optional)
Creating an account is entirely optional and only necessary if you wish to host persistent Jam Rooms or save custom playlists across sessions. 
If you choose to register an account, the following information is processed:
* **Email Address:** Used as your username handle for authentication.
* **Password Hashes:** Managed and secured cryptographically by our authentication handler, **Supabase Auth**. Plaintext passwords are never visible to or stored by Wavy.
* **Playlist and Room Metadata:** Custom playlist metadata (track IDs, playlist names) and persistent room settings are stored securely within our Supabase PostgreSQL database instance.

### 2.3 Ephemeral Data Handling (Jam Room Sessions)
Synchronized listening rooms require real-time synchronization of audio state and text chats. This data is handled under strict security and privacy protocols:
* **In-Memory Volatile Processing (RAM):** WebSocket payloads (including chat messages, active player positions, and room queues) pass directly through the volatile memory (RAM) of our synchronization server.
* **Zero Disk Storage:** Chat messages and room queue interactions are **never written to a database or hard disk**. 
* **Immediate Deletion:** Once a Jam Room is closed or terminated, the in-memory room structure, associated chat history, and playback queue are completely wiped and cannot be recovered.

### 2.4 Downstream & Third-Party Data Handlers
To deliver the Service, Wavy coordinates with a limited number of downstream providers. Each provider processes baseline network data in accordance with their respective privacy policies:
1. **Jamendo API:** When retrieving audio files and metadata, your browser sends requests directly to Jamendo's servers. Jamendo may log standard network metadata (such as IP addresses and user-agent strings) required to deliver the audio files.
2. **Supabase:** Used to manage user accounts, authentication sessions, and metadata databases.
3. **Hosting Infrastructure (e.g., Vercel, Railway, or Self-Hosted Providers):** The servers hosting the frontend web files and the real-time WebSocket backend log standard web requests (such as routing logs, client IP address, timestamp, and request path) for security auditing, DDoS mitigation, and server health analysis.

---

## SECTION 3: CREATIVE COMMONS & MIT LICENSE DISCLOSURE

### 3.1 Creative Commons & Public Attribution Notice
All music content made streamable via the Wavy application is published under **Creative Commons (CC)** licensing terms or other free/open distribution terms by independent artists. 

Wavy enforces artist attribution dynamically via the Jamendo metadata engine. Below is the layout for licensing and attribution displayed within the application interface:

```markdown
================================================================================
                           MUSIC ATTRIBUTION NOTICE
================================================================================
Track Title:   [DYNAMIC_TRACK_NAME]
Artist:        [DYNAMIC_ARTIST_NAME]
Source URL:    https://www.jamendo.com/track/[DYNAMIC_TRACK_ID]
License Type:  Creative Commons ([DYNAMIC_CC_LICENSE_STRING])

This track is streamed dynamically using the Jamendo API. The audio is licensed 
under the specific Creative Commons terms indicated by the creator. You are 
free to share, copy, or distribute the material in accordance with the terms of 
the applicable Creative Commons license.
================================================================================
```

### 3.2 MIT Open-Source Software License
The source code of the Wavy application is licensed under the terms of the MIT License:

```text
Copyright (c) 2026 Wavy Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 3.3 Forking, Mirroring, and Self-Hosting
Because Wavy is fully open-source and MIT-licensed:
* **Forking & Customizing:** Developers are free to fork the codebase, modify it, and add new features without restriction, provided they retain the original copyright notice.
* **Self-Hosting:** Developers can self-host their own frontend clients and backend coordination servers. When self-hosting, developers must supply their own third-party credentials (such as their own Jamendo Client ID and Supabase configuration keys) to prevent abuse or service exhaustion on the main public project endpoints.
* **Compliance Duty:** Any self-hosted mirror remains subject to local laws and regulations regarding data privacy (e.g., GDPR/CCPA) and API compliance guidelines set by Jamendo.
