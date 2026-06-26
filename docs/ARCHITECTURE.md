# FreindZX — Complete Application Architecture

> **Stack:** React · TypeScript · Node.js · Express · PostgreSQL · MongoDB · Redis · Kafka · Docker · AWS S3 · WebRTC · Socket.IO

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Service Map & Port Registry](#2-service-map--port-registry)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Infrastructure Components Deep Dive](#4-infrastructure-components-deep-dive)
5. [Authentication & Security Flow](#5-authentication--security-flow)
6. [Real-Time Communication Layer](#6-real-time-communication-layer)
7. [Media Pipeline](#7-media-pipeline)
8. [System Design Flow Diagrams](#8-system-design-flow-diagrams)
9. [Future Scale Architecture](#9-future-scale-architecture)
10. [Android Conversion Guide](#10-android-conversion-guide)

---

## 1. High-Level Overview

FreindZX is a **location-based social platform** built on a microservices architecture. Users discover and connect with people nearby, share posts and short videos (crations), video chat in real time, and participate in daily challenges.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│   React + Vite (SPA)  ·  Android WebView (future)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼──────────────────────────────────────┐
│                     API GATEWAY  :3000                           │
│   JWT verification · Rate limiting · Proxy routing · CORS        │
└─┬──────┬───────┬──────┬──────┬──────┬──────┬──────┬────────────┘
  │      │       │      │      │      │      │      │
  ▼      ▼       ▼      ▼      ▼      ▼      ▼      ▼
AUTH  USER   LOCATION NOTIF  POST  RANDCONN CHALLENGE LOCATION
:3001 :3002   :3003   :3004  :3006   :3007   :3008    (BT)
  │      │       │      │      │      │      │
  └──────┴───────┴──────┴──────┴──────┴──────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     PostgreSQL       MongoDB        Redis
   (auth, user,    (location,     (sessions,
    posts media)   posts mongo,    cache, geo,
                   crations,       queues)
                   communities,
                   challenges)
                         │
                    Apache Kafka
               (event bus between services)
```

---

## 2. Service Map & Port Registry

| Service | Port | Database | Key Responsibilities |
|---|---|---|---|
| **api-gateway** | 3000 | — | JWT auth, rate limiting, proxy all `/api/*` routes |
| **auth-service** | 3001 | PostgreSQL (5432) + Redis | Register/login with OTP, JWT issue, OAuth (Google/GitHub), password reset |
| **user-service** | 3002 | PostgreSQL (5433) | User profiles, follow/unfollow, discovery, search |
| **location-service** | 3003 | MongoDB + Redis GEO | GPS tracking, nearby user search, Bluetooth proximity (BLE + pairing codes) |
| **notification-service** | 3004 | Redis | Socket.IO real-time: notifications, chat, WebRTC signaling, call handling |
| **post-service** | 3006 | PostgreSQL (5434) + MongoDB + S3/Local | Posts (images + text), media pipeline (Sharp/FFmpeg), feeds, crations, stories, communities |
| **random-connect-service** | 3007 | Redis | Nearby video rooms, 1-on-1 random video matchmaking, WebRTC signaling |
| **challenge-service** | 3008 | MongoDB | Daily math challenges, friend challenges, community challenges, streaks |

### Infrastructure Services

| Service | Port | Purpose |
|---|---|---|
| postgres-auth | 5432 | Auth user accounts |
| postgres-user | 5433 | User profiles, follow graph |
| postgres-post | 5434 | Posts, media metadata (Prisma ORM) |
| MongoDB | 27017 | Location history, crations, stories, communities, challenges |
| Redis | 6379 | Sessions, OTPs, notification queues, rate limiting, BT tokens |
| Redis GEO | 6380 | Geospatial user positions, nearby video rooms |
| Kafka | 9092 | Async event bus between services |
| Zookeeper | 2181 | Kafka coordination |

---

## 3. Data Flow Architecture

### 3.1 Request Lifecycle

```
Browser/App
    │
    │ 1. HTTP request with Authorization: Bearer <JWT>
    ▼
API Gateway (port 3000)
    │ 2. verifyToken() — jwt.verify(token, JWT_SECRET)
    │    → extracts userId, stamps x-user-id header
    │ 3. Rate limit check
    │ 4. Path-based proxy routing
    ▼
Target Microservice
    │ 5. Business logic executes
    │ 6. DB read/write
    │ 7. Kafka event published (async, non-blocking)
    ▼
Response to client
```

### 3.2 Database Assignment by Concern

```
PostgreSQL (relational, ACID)
├── auth_db       → users table (email, password hash, OAuth IDs)
├── user_db       → user_profiles, follows, interests
└── post_db       → posts, media, post_media (Prisma ORM)
                     • cursor-based pagination
                     • aspect ratio stored for dynamic rendering

MongoDB (document, flexible schema)
├── location_db   → location_history, nearby cache
├── posts_db      → crations, stories, communities, comments
│                   (community posts use MongoDB for geo queries)
└── challenges_db → dailychallenges, dailyattempts, streaks,
                    friendchallenges, communitychallenges

Redis (in-memory, TTL-based)
├── redis:6379    → otp:{email} (10min TTL)
│                   reset:{email} (10min TTL — password reset)
│                   bt:token:{code} (5min TTL — BT pairing)
│                   bt:mytoken:{userId}
│                   bt:blescan:{userId} (45s TTL)
│                   rc:queue (matchmaking queue)
│                   rc:match:{userId} (active match)
│                   session data, rate limit counters
└── redis-geo:6380→ users:geo (GEOADD/GEORADIUS for nearby users)
                    vrooms:geo (nearby video rooms)
```

---

## 4. Infrastructure Components Deep Dive

### 4.1 Redis — 6 Distinct Use Cases

```
┌─────────────────────────────────────────────────────────────┐
│                         REDIS                                │
│                                                             │
│  1. OTP Store        otp:{email}       TTL: 10 min          │
│     Used by:         /send-otp, /register, /forgot-password  │
│                                                             │
│  2. Session Cache    auth tokens       TTL: matches JWT      │
│     Used by:         auth-service login responses            │
│                                                             │
│  3. BT Discovery     bt:token:{code}   TTL: 5 min           │
│                      bt:blescan:{uid}  TTL: 45s             │
│     Used by:         location-service Bluetooth proximity    │
│                                                             │
│  4. Random Connect   rc:queue          TTL: 30 min          │
│                      rc:match:{uid}    TTL: 30 min          │
│     Used by:         random-connect-service matchmaking      │
│                                                             │
│  5. Notifications    notification:{uid} list                 │
│     Used by:         notification-service                    │
│                                                             │
│  6. Rate Limiting    ratelimit:{ip}    sliding window        │
│     Used by:         api-gateway, post-service upload        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      REDIS GEO                               │
│                                                             │
│  users:geo     GEOADD/GEORADIUS for live user positions      │
│  vrooms:geo    GEOADD/GEORADIUS for nearby video rooms       │
│                                                             │
│  Commands used:                                             │
│    GEOADD   users:geo <lng> <lat> <userId>                  │
│    GEORADIUS users:geo <lng> <lat> 200 m ASC WITHCOORD      │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Apache Kafka — Event Bus

All services publish events to Kafka topics and consume what they need. This decouples services and enables async processing.

```
PRODUCERS                    TOPIC                    CONSUMERS
─────────────────────────────────────────────────────────────────
auth-service ──────────► user.registered    ──────► user-service
                                            ──────► notification-service

auth-service ──────────► user.logged-in     ──────► user-service

user-service ──────────► user.followed      ──────► notification-service
user-service ──────────► user.profile-updated ────► notification-service

location-service ──────► location.updated   ──────► notification-service

post-service ──────────► post-service-events
              Topics within:
               • MEDIA_UPLOADED             ──────► (logging/analytics)
               • MEDIA_PROCESSING_STARTED   ──────► (worker queues)
               • MEDIA_PROCESSING_COMPLETED ──────► (CDN invalidation)
               • MEDIA_PROCESSING_FAILED    ──────► (retry logic)
               • POST_CREATED               ──────► notification-service
                                            ──────► feed-service (future)

challenge-service ─────► challenge.completed ─────► notification-service
```

**Why Kafka instead of direct HTTP calls?**
- Services don't need to know each other's addresses
- If notification-service is down, events queue up and replay when it restarts
- Easy to add new consumers (analytics, email service) without touching producers
- Horizontal scaling: multiple consumers on same topic (consumer groups)

### 4.3 Socket.IO — Real-Time Layer

All real-time communication flows through **notification-service** (port 3004):

```
Client ←──WebSocket──► notification-service (Socket.IO)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Notifications    Chat/DMs       WebRTC Signaling
         push to user     messages,      call:request
         bell icon        attachments    call:offer/answer
                          read receipts  call:ice-candidate
                                         call:end
```

**Socket.IO namespaces/rooms:**
- `user:{userId}` — each user's personal room
- `call:{callId}` — active call participants

**random-connect-service** runs its own Socket.IO server for video rooms:
```
room:{roomId}   — participants in a video room
user:{userId}   — direct signaling channel
```

### 4.4 WebRTC — Peer-to-Peer Video

```
UserA                    Signal Server               UserB
  │                    (notification-svc)               │
  │──── call:request ──────────────────────────────────►│
  │                                                     │
  │◄─── call:approve ──────────────────────────────────│
  │                                                     │
  │──── call:offer (SDP) ──────────────────────────────►│
  │◄─── call:answer (SDP) ─────────────────────────────│
  │                                                     │
  │──── call:ice ◄──────────────────────────────────────│
  │          │                                          │
  │          └── ICE candidates exchanged               │
  │                                                     │
  │◄══════════ Direct P2P media stream ════════════════►│
  │         (STUN: stun.l.google.com:19302)             │
```

---

## 5. Authentication & Security Flow

### 5.1 Registration Flow

```
Client                  API Gateway        Auth Service           Redis    Email
  │                         │                   │                   │        │
  │──POST /api/auth/send-otp──►│                   │                   │        │
  │                         │──forward──────────►│                   │        │
  │                         │                   │──SETEX otp:email──►│        │
  │                         │                   │                   │        │
  │                         │                   │──────send email────────────►│
  │◄── {message: OTP sent} ─┤◄──────────────────│                   │        │
  │                         │                   │                   │        │
  │──POST /api/auth/register (email+pw+otp)──────►│                   │        │
  │                         │──forward──────────►│                   │        │
  │                         │                   │──GET otp:email────►│        │
  │                         │                   │◄── "123456" ───────│        │
  │                         │                   │── validate OTP     │        │
  │                         │                   │── bcrypt.hash(pw)  │        │
  │                         │                   │── INSERT user      │        │
  │                         │                   │── DEL otp:email───►│        │
  │                         │                   │── Kafka: user.registered
  │◄── {token, user} ───────┤◄──────────────────│                   │        │
```

### 5.2 Login Flow (Email OR Username)

```
Client            API Gateway         Auth Service        PostgreSQL
  │                    │                   │                   │
  │─POST /login {identifier, password}─────►│                   │
  │                    │──────────────────►│                   │
  │                    │                   │─ is email? ────────►│
  │                    │                   │   findByEmail()     │
  │                    │                   │   OR findByUsername()
  │                    │                   │◄─── user row ──────│
  │                    │                   │─ bcrypt.compare()  │
  │                    │                   │─ jwt.sign()        │
  │◄── {token, refreshToken, user} ────────┤◄──────────────────│
  │  token stored in localStorage          │                   │
```

### 5.3 JWT Token Flow

```
Every subsequent request:

Client                    API Gateway
  │                           │
  │── GET /api/posts/feed ─────►│
  │  Authorization: Bearer <JWT>│
  │                           │
  │                           │─ jwt.verify(token, JWT_SECRET)
  │                           │─ decode: { id, email, iat, exp }
  │                           │─ stamp: req.headers['x-user-id'] = id
  │                           │─ proxy to post-service
  │                           │
  │                      post-service reads x-user-id header
  │                      (no re-verification needed downstream)
```

**Token specs:**
- Access token: `JWT_EXPIRY=7d` (configurable)
- Refresh token: `JWT_REFRESH_EXPIRY=7d`
- Algorithm: HS256
- Secret: `JWT_SECRET` env var

---

## 6. Real-Time Communication Layer

### 6.1 Notification Pipeline

```
Event Source ──► Kafka ──► notification-service consumer
                                    │
                         ┌──────────▼──────────┐
                         │  Redis notification  │
                         │  store (persistent)  │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  Socket.IO emit to   │
                         │  user:{userId} room  │
                         └──────────┬──────────┘
                                    │
                         Client bell icon updates
                         (unread count, notification list)
```

### 6.2 Chat System

```
UserA                  notification-service               UserB
  │                           │                             │
  │─── chat:send ─────────────►│                             │
  │    {toUserId, text,        │── store in Redis ───────────│
  │     attachments}           │── emit chat:message ────────►│
  │                           │                             │
  │◄── chat:delivered ─────────│                             │
```

Chat attachments (images/files) are:
1. Uploaded via `POST /api/notifications/chat/upload` (multipart)
2. Stored locally in notification-service container
3. Served at `/api/notifications/chat/attachment/:filename` (public, no auth — UUID is the access control)

### 6.3 Bluetooth Proximity Discovery

Two modes when GPS is unavailable:

**Mode A — BLE Fingerprinting (Chrome experimental)**
```
UserA device                 location-service              UserB device
  │ scan BLE devices           │                              │
  │─── bt:ble-scan ────────────►│                              │
  │    {bleDeviceIds: [...]}    │ store bt:blescan:{A}          │
  │                             │                              │
  │                             │◄─── bt:ble-scan ─────────────│
  │                             │    {bleDeviceIds: [...]}      │
  │                             │                              │
  │                             │ Jaccard similarity(A, B) > 0.3
  │◄── bt:user-found ───────────│──── bt:user-found ───────────►│
```

**Mode B — Pairing Code (Universal)**
```
UserA                        location-service              UserB
  │◄── bt:your-token ──────────│── generates "A3K9Z7" ─────────│
  │    "A3K9Z7"                │── SETEX bt:token:A3K9Z7 5min  │
  │                             │                              │
  │  [UserA shares code]        │                              │
  │                             │                              │
  │                             │◄─── bt:use-token ────────────│
  │                             │     {code: "A3K9Z7"}         │
  │                             │                              │
  │◄── bt:user-found ───────────│──── bt:user-found ───────────►│
  │    {userId: B}              │                              │
```

---

## 7. Media Pipeline

### 7.1 Post Image Upload Flow

```
Browser                API Gateway    post-service    Storage (S3/Local)
  │                        │              │                │
  │─ POST /api/media/presigned-url ───────►│                │
  │  {mimeType, fileSize, fileName}        │                │
  │                        │              │─ create Media row (PENDING)
  │                        │              │─ generate upload URL
  │◄── {config, media} ────┤◄─────────────│                │
  │    config.uploadUrl:   │              │                │
  │    /api/media/local-upload/:key        │                │
  │                        │              │                │
  │─ PUT /api/media/local-upload/:key ─────►│                │
  │  (raw binary body)                     │─ write file ──►│
  │◄── {ok: true} ─────────┤◄─────────────│                │
  │                        │              │                │
  │─ POST /api/media/complete-upload ──────►│                │
  │  {mediaId}                             │─ update PROCESSING
  │◄── {processingStatus: PROCESSING} ─────┤◄─────────────│
  │                        │              │                │
  │          [ASYNC — background goroutine]│                │
  │                        │              │─ read file ────►│ (get buffer)
  │                        │              │─ Sharp.resize() │
  │                        │              │─ thumbnail 300px│
  │                        │              │─ full 1080px   │
  │                        │              │─ write outputs ►│
  │                        │              │─ update COMPLETED
  │                        │              │─ Kafka: MEDIA_PROCESSING_COMPLETED
```

### 7.2 Supported Media Formats

**Images** (processed by Sharp):
- Input: `.jpg` / `.jpeg` → `image/jpeg`
- Input: `.png` → `image/png`
- Input: `.webp` → `image/webp`
- Output: Always JPEG (thumbnail 300px, medium 720px, full 1080px)
- Instagram aspect ratios: 1:1, 4:5, 1.91:1, 9:16 (auto-crop if outside bounds)

**Videos** (processed by FFmpeg) — Crations only:
- Input: `.mp4`, `.mov`, `.webm`
- Output: 480p, 720p, 1080p MP4 + thumbnail frame at 1s
- Stored as: `users/{userId}/videos/{uuid}_720p.mp4`

### 7.3 Storage Structure

```
S3 Bucket: freindz-media  (or local: /app/uploads)
└── users/
    └── {userId}/
        ├── images/
        │   └── {uuid}.jpg          ← original upload
        ├── videos/
        │   ├── {uuid}_480p.mp4
        │   ├── {uuid}_720p.mp4     ← optimizedUrl
        │   └── {uuid}_1080p.mp4
        └── thumbnails/
            ├── {uuid}_thumb.jpg    ← thumbnailUrl (300px)
            └── {uuid}_full.jpg     ← full processed image
```

---

## 8. System Design Flow Diagrams

### 8.1 User Discovery Flow

```
UserA opens Explore page
         │
         │ GET /api/users/discover
         ▼
   user-service
         │ SELECT from user_profiles WHERE NOT blocked
         │ ORDER BY interests overlap, distance
         ▼
   Returns PublicProfile[]
         │
         ▼
   UserA clicks profile card
         │
         │ GET /api/users/public/{userId}    (profile data)
         │ GET /api/posts/user/{userId}      (their posts)
         │ GET /api/crations/user/{userId}   (their crations)
         ▼
   UserProfileModal renders
```

### 8.2 Nearby Users Flow

```
UserA opens dashboard
         │
         │ Browser geolocation API
         │ navigator.geolocation.getCurrentPosition()
         │
         │ POST /api/locations/update
         │ {latitude, longitude, accuracy}
         ▼
   location-service
         │ GEOADD users:geo {lng} {lat} {userId}     ← Redis GEO
         │ INSERT INTO location_history (MongoDB)
         │ Kafka: location.updated
         ▼
         │ GET /api/locations/nearby?radius=200
         ▼
   location-service
         │ GEORADIUS users:geo {lng} {lat} 200 m ASC ← Redis GEO
         │ Returns [{userId, distance, coordinates}]
         ▼
   Frontend renders NearbyUsers cards
```

### 8.3 Feed Cursor Pagination

```
Client: GET /api/posts/feed?limit=20
                  │
                  ▼
            post-service
                  │ SELECT * FROM posts
                  │ WHERE visibility = 'PUBLIC'
                  │ ORDER BY createdAt DESC
                  │ TAKE 21 (limit + 1)
                  │
                  │ If 21 rows returned:
                  │   hasMore = true
                  │   nextCursor = base64(items[19].createdAt)
                  │   return items[0..19]
                  │
                  ▼
Client: GET /api/posts/feed?cursor={nextCursor}&limit=20
                  │
                  ▼
            post-service
                  │ SELECT * FROM posts
                  │ WHERE visibility = 'PUBLIC'
                  │   AND createdAt < decode(cursor)
                  │ ORDER BY createdAt DESC
                  │ TAKE 21
```

**Why cursor-based over page-based?**
- No duplicate items when new posts are inserted between page loads
- O(1) lookup with index on `(visibility, createdAt DESC)`
- Works correctly with real-time feeds

---

## 9. Future Scale Architecture

### 9.1 Current Bottlenecks & Solutions

| Bottleneck | Current State | Scaled Solution |
|---|---|---|
| Single API gateway | 1 Node.js process | Nginx L7 LB + multiple gateway instances |
| Media processing | Synchronous in post-service | Dedicated media-worker service consuming Kafka |
| Location queries | Redis GEO single instance | Redis Cluster or ElastiCache |
| Feed generation | Real-time DB query | Pre-computed feed cache (Redis Lists) |
| WebRTC direct P2P | STUN only (may fail on corporate NAT) | Add TURN server (coturn) |

### 9.2 Scaled Architecture (Low-Cost AWS)

```
┌────────────────────────────────────────────────────────────┐
│                     CLOUDFRONT CDN                          │
│   Static assets (JS/CSS/images) · Global edge cache         │
│   Price: ~$0.085/GB transfer · Free tier: 1TB/mo           │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│               AWS APPLICATION LOAD BALANCER                  │
│   Path-based routing · Health checks · SSL termination       │
│   Price: ~$16/mo base + $0.008/LCU                         │
└──┬────────┬─────────┬────────┬────────┬────────┬───────────┘
   │        │         │        │        │        │
   ▼        ▼         ▼        ▼        ▼        ▼
 API-GW   API-GW    API-GW  (Auto Scaling Group — ECS Fargate)
  t3.small t3.small  t3.small  ~$15/mo per instance

┌──────────────────────────────────────────────────────────────┐
│                 MICROSERVICE LAYER  (ECS Fargate)             │
│                                                              │
│  auth    user   location  notification  post  challenge       │
│  :3001   :3002   :3003      :3004       :3006   :3008         │
│                                                              │
│  Each service: 0.25 vCPU · 512MB RAM · ~$7/mo per service   │
│  Total 8 services: ~$56/mo                                   │
└──────────────────────┬───────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────────┐
│                   DATA LAYER                                  │
│                                                              │
│  RDS PostgreSQL (db.t3.micro) ──────── $15/mo               │
│   • Multi-AZ read replica (+$15) for HA                     │
│   • Automated backups (7 days retention)                     │
│                                                              │
│  MongoDB Atlas M10 cluster ─────────── $57/mo               │
│   • 3-node replica set                                       │
│   • 10GB storage included                                    │
│   • Automatic failover                                       │
│                                                              │
│  ElastiCache Redis (cache.t3.micro) ── $15/mo               │
│   • Redis 7 · 0.5GB memory                                  │
│   • Cluster mode disabled (simple setup)                     │
│                                                              │
│  Amazon S3 (media storage) ─────────── ~$3/mo               │
│   • $0.023/GB stored                                        │
│   • CloudFront distribution in front                         │
│                                                              │
│  Amazon MSK (Kafka) ─────────────────── $45/mo              │
│   • kafka.t3.small · 2 brokers                              │
│   • OR: use Upstash Kafka ($0 free tier, pay per msg)       │
└──────────────────────────────────────────────────────────────┘

ESTIMATED TOTAL: ~$200-250/month for production-grade setup
FREE TIER (first 12 months): reduces to ~$100/month
```

### 9.3 CDN Strategy

```
Static Assets (React build)
         │
         ├── S3 bucket (origin)
         │   └── CloudFront distribution
         │       ├── TTL: 1 year for hashed assets
         │       ├── TTL: 5 min for index.html
         │       └── Gzip + Brotli compression
         │
Media Files (user uploads)
         │
         ├── S3 bucket: freindz-media (private)
         │   └── CloudFront with OAC (Origin Access Control)
         │       ├── Signed URLs for private content
         │       ├── TTL: 24 hours for media
         │       └── WebP auto-conversion (CloudFront Lambda@Edge)
         │
         └── CDN URL pattern:
             https://cdn.freindz.com/users/{id}/images/{uuid}.jpg
```

### 9.4 Database Sharding Strategy (When Needed)

```
Current (vertical):
  posts table: 1 PostgreSQL instance handles all users

Phase 1 — Read Replicas (~1M users):
  Primary ──► Replica 1 (EU)
         └──► Replica 2 (Asia)
  Writes: primary only
  Reads: routed to nearest replica

Phase 2 — Horizontal Sharding (~10M users):
  Shard key: userId (hash-based)
  Shard 0: userId hash % 4 == 0  (postgres-post-0)
  Shard 1: userId hash % 4 == 1  (postgres-post-1)
  ...
  Use: Citus (PostgreSQL extension) OR PlanetScale (MySQL)

Feed Service (future separate service):
  Redis Sorted Set per user: feed:{userId}
  ZADD feed:{userId} {timestamp} {postId}
  Fan-out on write (push model) for users with < 10K followers
  Fan-out on read (pull model) for celebrities (> 10K followers)
```

### 9.5 Horizontal Scaling Rules

```
Auto-scaling triggers:
├── API Gateway:        CPU > 70% → add instance
├── Notification Svc:   WebSocket connections > 5000 → add instance
│   (use Redis pub/sub for cross-instance Socket.IO)
├── Post Service:       CPU > 60% OR queue depth > 100 → add instance
└── Media Workers:      Kafka consumer lag > 1000 → add worker

Load Balancer health checks:
  GET /health → 200 OK required
  Interval: 10s · Unhealthy threshold: 3 failures
  Drain: 30s before removing from rotation
```

### 9.6 Monitoring Stack (Low Cost)

```
Metrics:    Prometheus + Grafana (self-hosted on t3.micro, ~$8/mo)
Logging:    AWS CloudWatch Logs (~$0.50/GB)
Tracing:    AWS X-Ray (first 100k traces free)
Uptime:     UptimeRobot (free tier — 50 monitors)
Errors:     Sentry (free tier — 5K errors/month)
```

---

## 10. Android Conversion Guide

### 10.1 Approach Options

| Approach | Cost | Performance | Time to Market |
|---|---|---|---|
| **WebView wrapper** (recommended) | Free | Good | 1-2 weeks |
| React Native rewrite | High dev time | Excellent | 3-6 months |
| Capacitor (hybrid) | Free | Good | 2-4 weeks |
| Progressive Web App (PWA) | Free | Good | 1 week |

**Recommended:** Start with WebView wrapper → migrate to Capacitor.

---

### 10.2 Option A — WebView Android App (Fastest, Free)

#### Step 1: Prerequisites

```bash
# Install Android Studio
# https://developer.android.com/studio

# Install JDK 17+
sudo apt install openjdk-17-jdk   # Linux
brew install openjdk@17           # Mac

# Verify
java -version   # openjdk 17.x.x
```

#### Step 2: Create Android Project

1. Open **Android Studio** → New Project
2. Select **Empty Views Activity**
3. Set package name: `com.freindz.app`
4. Min SDK: API 24 (Android 7.0 — covers 95% of devices)
5. Language: **Java** or **Kotlin**

#### Step 3: Configure WebView

**`app/src/main/java/com/freindz/app/MainActivity.kt`**
```kotlin
import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        webView.settings.apply {
            javaScriptEnabled          = true
            domStorageEnabled          = true        // localStorage
            databaseEnabled            = true
            mediaPlaybackRequiresUserGesture = false  // autoplay videos
            allowFileAccessFromFileURLs = true
            mixedContentMode           = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString            = "FreindZX-Android/1.0 ${userAgentString}"
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                // Grant camera + microphone for WebRTC
                request.grant(request.resources)
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                // Inject native bridge
            }
        }

        // Production: point to your deployed URL
        // Development: use ngrok or local IP
        webView.loadUrl("https://app.freindz.com")
    }

    // Handle hardware back button
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
```

**`app/src/main/res/layout/activity_main.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</RelativeLayout>
```

#### Step 4: Required Permissions

**`app/src/main/AndroidManifest.xml`**
```xml
<manifest ...>

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <application
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true"
        ...>
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

#### Step 5: Handle Permissions at Runtime

```kotlin
// In MainActivity.kt
private val PERMISSIONS = arrayOf(
    Manifest.permission.CAMERA,
    Manifest.permission.RECORD_AUDIO,
    Manifest.permission.ACCESS_FINE_LOCATION
)

override fun onCreate(...) {
    ...
    if (!hasPermissions()) requestPermissions(PERMISSIONS, 1001)
    webView.loadUrl("https://app.freindz.com")
}

private fun hasPermissions() = PERMISSIONS.all {
    ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
}
```

#### Step 6: Frontend Adjustments for Mobile

Add to `index.html` or `App.tsx`:
```html
<!-- In index.html <head> -->
<meta name="viewport" content="width=device-width, initial-scale=1.0,
      maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

Detect WebView in React:
```typescript
// frontend/src/utils/platform.ts
export const isAndroidWebView = (): boolean =>
  /FreindZX-Android/.test(navigator.userAgent);

export const isMobile = (): boolean =>
  /Android|iPhone|iPad/.test(navigator.userAgent);
```

#### Step 7: Build Release APK

```bash
# Generate signing keystore (one time)
keytool -genkey -v \
  -keystore freindz-release.keystore \
  -alias freindz \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Build release APK
./gradlew assembleRelease

# Sign the APK
jarsigner -verbose -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore freindz-release.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  freindz

# Align the APK
zipalign -v 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  freindz-release.apk
```

#### Step 8: Build AAB for Play Store (Preferred)

```bash
# Build Android App Bundle
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab
```

---

### 10.3 Option B — Capacitor (Recommended for Production)

Capacitor wraps the same React web app into a native Android app with access to native APIs.

#### Installation

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android

npx cap init FreindZX com.freindz.app --web-dir dist

# Add Android platform
npx cap add android
```

**`capacitor.config.ts`**
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.freindz.app',
  appName: 'FreindZX',
  webDir: 'dist',
  server: {
    // For development: point to local server
    url: 'http://192.168.1.x:5173',
    cleartext: true,
    // For production: remove server block — app uses bundled build
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    Geolocation: { requestPerms: true }
  }
};

export default config;
```

#### Add Native Plugins

```bash
npm install @capacitor/geolocation
npm install @capacitor/camera
npm install @capacitor/push-notifications
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
```

#### Build and Sync

```bash
npm run build           # Build React app → dist/
npx cap sync android    # Copy to Android project + install plugins
npx cap open android    # Open in Android Studio
```

---

### 10.4 Google Play Store Submission

#### Step 1: Play Console Setup

1. Go to [play.google.com/console](https://play.google.com/console)
2. Pay **one-time $25 registration fee**
3. Create new app → set App name: **FreindZX**
4. App category: **Social**

#### Step 2: Required Assets

| Asset | Size | Notes |
|---|---|---|
| App icon | 512×512 PNG | No transparency |
| Feature graphic | 1024×500 PNG | Banner shown in store |
| Screenshots (phone) | Min 2, max 8 | 16:9 or 9:16 ratio |
| Screenshots (tablet) | Optional but recommended | 16:10 ratio |
| Short description | Max 80 chars | Shown in search |
| Full description | Max 4000 chars | Feature list |
| Privacy Policy URL | Required | Must host publicly |

#### Step 3: Store Listing Content

```
App Name: FreindZX — Discover People Nearby

Short Description:
Connect with interesting people near you through posts, video chats & challenges.

Full Description:
FreindZX helps you discover and connect with like-minded people in your area.

🗺️ Location-based discovery — find people with shared interests near you
📸 Posts & Crations — share photos and short videos with your community
💬 Real-time chat — instant messaging with end-to-end awareness
📹 Video calls — 1-on-1 and group video calls powered by WebRTC
🎯 Daily challenges — math challenges with streaks and leaderboards
🔵 Bluetooth discovery — find people nearby even without GPS
🏘️ Communities — create and join local interest groups
🎲 Random Connect — spontaneous video meetups with nearby strangers

Privacy-first design: location data is never sold or shared with third parties.
```

#### Step 4: Content Rating

Complete the IARC questionnaire:
- Violence: None
- Sexual content: None
- Language: Mild (social chat)
- Location sharing: Yes (core feature)
- User-generated content: Yes → requires content moderation policy

Expected rating: **Teen (T)** or **Everyone 13+**

#### Step 5: Privacy Policy Requirements

Host a privacy policy at `https://freindz.com/privacy` covering:
- What location data is collected and why
- How long it is retained (recommend: 30 days history)
- User deletion rights (GDPR / CCPA)
- Third-party services used (Google OAuth, AWS)
- Parental controls (if targeting under 13, COPPA compliance required)

#### Step 6: Review and Launch

```
Timeline estimate:
  New app review:    3-7 business days
  Update reviews:    1-3 business days

Common rejection reasons:
  ✗ App crashes on launch
  ✗ Broken links in store listing
  ✗ Privacy policy missing or incomplete
  ✗ Permissions requested but not used
  ✗ Camera/location used without clear explanation
```

---

### 10.5 Push Notifications for Android

Firebase Cloud Messaging (FCM) — free tier covers most use cases:

#### Setup

```bash
# 1. Create project at console.firebase.google.com
# 2. Add Android app with package name: com.freindz.app
# 3. Download google-services.json → app/ directory

# Install FCM in notification-service
npm install firebase-admin
```

#### Backend Integration

```typescript
// notification-service: push.ts
import * as admin from 'firebase-admin';

const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

export async function sendPush(deviceToken: string, title: string, body: string, data?: object) {
  await admin.messaging().send({
    token: deviceToken,
    notification: { title, body },
    data: data as Record<string, string>,
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'freindz_default' }
    }
  });
}
```

#### Frontend Token Registration

```typescript
// frontend/src/services/pushService.ts
import { PushNotifications } from '@capacitor/push-notifications';

export async function registerPushToken(userId: string) {
  await PushNotifications.requestPermissions();
  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    // Send token to your backend
    await apiClient.post('/users/device-token', { token: token.value });
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // Handle foreground notification
    console.log('Push received:', notification);
  });
}
```

---

### 10.6 Performance Checklist for Mobile

Before submitting to Play Store:

- [ ] `<meta name="viewport">` with `user-scalable=no`
- [ ] Touch targets minimum 44×44px (check all buttons)
- [ ] No hover-only interactions (hover doesn't exist on touch)
- [ ] Images use `loading="lazy"` and have explicit width/height
- [ ] CSS `overflow: hidden` on body (prevent bounce scroll)
- [ ] WebSocket reconnect on `visibilitychange` (app backgrounded/foregrounded)
- [ ] Camera/microphone permissions handled gracefully
- [ ] Offline fallback page (Service Worker)
- [ ] APK size < 100MB (Play Store hard limit for downloads over mobile data)
- [ ] Test on low-end Android device (2GB RAM, Android 7)
- [ ] Battery: disable location polling when app is backgrounded

---

*Last updated: June 2026 | FreindZX v2.0*
