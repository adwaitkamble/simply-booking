# Simply Booking - Hotel Property Management System (PMS)
## Architecture & Screen Flow Documentation

This document provides a comprehensive, easy-to-understand guide to the architecture, screen navigation flow, data models, and system components of **Simply Booking**.

---

## 🏗️ 1. High-Level System Architecture

Simply Booking is built as a production-grade TypeScript **Monorepo** using npm workspaces.

```mermaid
graph TD
    subgraph Client Layer [Frontend - Mobile / Tablet / Web]
        MobileApp["📱 React Native / Expo App (Android APK)"]
    end

    subgraph Network Layer [AWS Infrastructure & Gateway]
        Nginx["🌐 Nginx Reverse Proxy (SSL / HTTPS)"]
    end

    subgraph Backend Layer [AWS EC2 Virtual Machine]
        ExpressAPI["⚙️ Node.js Express REST API (apps/api)"]
        SocketIO["⚡ Socket.io Realtime Event Server"]
    end

    subgraph Database Layer [AWS RDS Cloud Database]
        PostgreSQL[("🛢️ PostgreSQL Database (Aurora / RDS)")]
        PrismaORM["💎 Prisma ORM Client (packages/database)"]
    end

    MobileApp -->|HTTPS / REST API| Nginx
    MobileApp <-->|WebSockets / WSS| SocketIO
    Nginx -->|Port 4000 Proxy| ExpressAPI
    ExpressAPI --> PrismaORM
    PrismaORM --> PostgreSQL
```

---

## 📱 2. Screen Flow & User Journey Diagram

The following diagram illustrates the complete user flow from app launch, authentication, main dashboard navigation, reservation creation, housekeeping management, billing, and OTA channels.

```mermaid
flowchart TD
    %% App Startup & Auth Flow
    Start([🚀 App Launch]) --> Splash[SPLASH SCREEN<br/>Session & Token Check]
    
    Splash -->|No Valid Token| AuthChoice{User Account Status}
    Splash -->|Valid JWT Token| MainApp[MAIN APP SHELL<br/>Navigator + Profile Bar]

    AuthChoice -->|Existing Account| LoginScreen["🔐 LOGIN SCREEN<br/>Email & Password"]
    AuthChoice -->|New Hotel Property| RegisterScreen["🏨 REGISTER SCREEN<br/>Property Name, City, Owner Details"]

    LoginScreen -->|Login Success| MainApp
    RegisterScreen -->|Registration Success| MainApp

    LoginScreen -.->|Switch to Register| RegisterScreen
    RegisterScreen -.->|Switch to Login| LoginScreen

    %% Main Application Bottom Tabs
    MainApp --> BottomTabs["👇 BOTTOM NAVIGATION TRACK"]
    
    BottomTabs --> Tab1["📅 TAB 1: CALENDAR & BOOKINGS"]
    BottomTabs --> Tab2["🧹 TAB 2: HOUSEKEEPING"]
    BottomTabs --> Tab3["💳 TAB 3: FOLIO & INVOICING"]
    BottomTabs --> Tab4["🌐 TAB 4: OTA CHANNEL HUB"]

    %% Tab 1: Booking Flow
    Tab1 --> Dashboard["DASHBOARD SCREEN<br/>• Property Metrics (Occupancy %, RevPAR)<br/>• 2D Gantt Interactive Booking Matrix<br/>• Available Rooms List"]
    Dashboard -->|Click Available Room / Date| AddBooking["➕ ADD RESERVATION SCREEN<br/>• Guest Name, Email, Phone<br/>• Check-in / Check-out Dates<br/>• Room Selection & Price Calculation"]
    AddBooking -->|Submit Booking| ConcurrencyCheck{Concurrency & Overlap Lock}
    ConcurrencyCheck -->|Success| Dashboard
    ConcurrencyCheck -->|Overlap Detected| AlertErr[⚠️ Error: Room Already Booked]

    Dashboard -->|Click Active Guest Reservation| InvoiceQuick["💳 View Folio / Checkout"]
    InvoiceQuick --> InvoiceScreen

    %% Tab 2: Housekeeping Flow
    Tab2 --> HousekeepingScreen["HOUSEKEEPING SCREEN<br/>• Room Turnover Status (Clean/Dirty/Maintenance)<br/>• One-Tap Status Toggle<br/>• Realtime Socket Sync"]
    HousekeepingScreen -->|Status Changed| SocketEvent["⚡ Socket.io Broadcast: room:status:updated"]
    SocketEvent -.->|Auto Refresh| Dashboard

    %% Tab 3: Invoicing Flow
    Tab3 --> InvoiceScreen["INVOICE SCREEN<br/>• Base Room Rate Breakdown<br/>• Ancillary Add-ons (Breakfast, Spa, Minibar)<br/>• Dynamic Tax & Total Calculation<br/>• Pay Invoice / Mark Paid"]

    %% Tab 4: Channel Manager Flow
    Tab4 --> ChannelScreen["CHANNEL MANAGER SCREEN<br/>• Simulated Inbound OTA Webhook (Booking.com/Agoda)<br/>• Live Two-Way Sync Audit Log<br/>• Direct vs OTA Distribution Metrics"]

    %% Profile / Tenant Modal
    MainApp --> ProfileBtn["👤 Profile Avatar (Top Bar)"]
    ProfileBtn --> ProfileModal["PROFILE MODAL<br/>• Active Property Details<br/>• Owner Info & Currency<br/>• Sign Out Button"]
    ProfileModal -->|Sign Out| LoginScreen
```

---

## 🧭 3. Detailed Screen Descriptions

### 1. **Authentication Flow**
* **Splash Screen**: Checks `AsyncStorage` for a stored JWT session token.
* **Login Screen**: Authenticates existing property owners or staff members (`demo@simplybooking.com` / `password123`).
* **Register Screen**: Onboards new hotel properties by capturing property name, address, city, country, currency, owner name, email, and password in a single SaaS registration step.

### 2. **Calendar & Booking Tab (`DashboardScreen` & `AddReservationScreen`)**
* **2D Gantt Chart**: Displays a live timeline grid of all property rooms versus calendar dates. Renders room number, dynamic room rate (e.g. `Deluxe • ₹3,100/night`), and room size specification badge (e.g. `📐 280 sq ft (Corner)`).
* **Add In-House Room Modal**: Allows hotel managers to add rooms on the fly with custom room numbers, dynamic room category creation (`+ Add New Category` to define custom categories like *Luxury Villa*, *Single Bed Room*, *Penthouse*), individual nightly rate override (`pricePerNight`), room dimensions/specs (`roomSize`), and initial cleanliness status (`Clean`, `Dirty`, `Maintenance`).
* **Interactive Slot Click**: Tapping any empty cell pre-fills check-in date and room details into the booking form.
* **Add Reservation Screen**: Captures guest details, calculates total stay costs using dynamic per-room rates (`pricePerNight ?? category.basePrice`), displays room sizes in the room picker, and handles concurrency locking to prevent double bookings.

### 3. **Housekeeping & Turnover Tab (`HousekeepingScreen`)**
* **Turnover Statuses**: `CLEAN`, `DIRTY`, `MAINTENANCE`.
* **Instant Toggle**: Staff can change room cleanliness status with a single tap.
* **Realtime Sync**: Emits Socket.io events to update room colors on the 2D Gantt dashboard instantly across all devices.

### 4. **Folio & Invoicing Tab (`InvoiceScreen`)**
* **Itemized Billing**: Combines dynamic room rates (`pricePerNight ?? category.basePrice`) with ancillary charges (room service, laundry, spa).
* **Payment Processing**: Calculates taxes automatically (18% GST) and records payments (`PAID` / `UNPAID` status).

### 5. **OTA Channel Hub Tab (`ChannelManagerScreen`)**
* **Webhook Simulator**: Simulates inbound reservations originating from external OTAs (e.g. Booking.com, Expedia, Agoda).
* **Two-Way Synchronization**: Automatically reserves rooms in PostgreSQL and updates distribution metrics (Direct vs OTA ratio).

---

## 🗄️ 4. SaaS Data Hierarchy

```mermaid
erDiagram
    CHAIN ||--|{ PROPERTY : owns
    PROPERTY ||--|{ ROOM_CATEGORY : contains
    ROOM_CATEGORY ||--|{ ROOM : defines
    ROOM {
        string id PK
        string roomNumber
        float pricePerNight "Custom per-room rate override"
        string roomSize "Size & type specs e.g. 250 sq ft"
        enum status "Clean | Dirty | Maintenance"
    }
    ROOM ||--|{ RESERVATION : hosts
    RESERVATION ||--o| INVOICE : generates
    INVOICE ||--|{ INVOICE_ITEM : includes
    PROPERTY ||--|{ USER : employs
```

---

## 🛠️ 5. Technology Stack Summary

* **Frontend**: React Native, Expo, React Native Safe Area Context, Socket.io Client.
* **Backend**: Node.js, Express, TypeScript, Socket.io, JWT Authentication, Bcrypt password hashing.
* **Database**: PostgreSQL on AWS RDS (Aurora Serverless), Prisma ORM v6.
* **Infrastructure**: AWS EC2 (Ubuntu Linux) + Docker / PM2 + Nginx Reverse Proxy with SSL/HTTPS.
