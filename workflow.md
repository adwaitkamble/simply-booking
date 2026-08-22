# Simply Booking - Hotel PMS Operational Workflow Documentation

This document contains the dedicated, step-by-step operational workflows and interaction sequence diagrams for **Simply Booking**.

---

## 🔄 1. End-to-End Hotel Operational Lifecycle Workflow

The sequence diagram below details the entire lifecycle of a reservation—from guest booking and channel synchronization to housekeeping room turnover and final bill checkout.

```mermaid
sequenceDiagram
    autonumber
    actor Guest as 👤 Guest / OTA Channel
    actor Reception as 🏨 Hotel Manager / Desk
    actor Staff as 🧹 Housekeeping Staff
    participant App as 📱 Mobile App (React Native)
    participant API as ⚙️ Express Backend API
    participant DB as 🛢️ PostgreSQL DB (AWS RDS)
    participant WS as ⚡ Socket.io Realtime Server

    %% Step 1: Booking Workflow
    rect rgb(240, 249, 255)
        note over Guest, DB: 1. Booking Creation Workflow
        alt Direct Walk-in / Phone Booking
            Reception->>App: Opens 2D Gantt Chart & clicks available room slot
            App->>API: POST /api/reservations (Guest Info, Dates, Room ID)
            API->>DB: Check Overlap & Insert Reservation Transaction
            DB-->>API: Reservation Created Success
        else Inbound OTA Booking (Booking.com / Agoda)
            Guest->>API: POST /api/webhooks/ota (Simulated Webhook)
            API->>DB: Insert Reservation & Audit Log
            DB-->>API: Saved
        end
        API->>WS: Broadcast event: 'reservation:created'
        WS-->>App: Push Realtime Update to all open devices
    end

    %% Step 2: Housekeeping Workflow
    rect rgb(254, 243, 199)
        note over Staff, DB: 2. Housekeeping Turnover Workflow
        Reception->>App: Guest Checks Out (Room set to DIRTY)
        App->>API: PATCH /api/rooms/:id/status (status: DIRTY)
        API->>DB: Update Room status log
        Staff->>App: Opens Cleaning Tab & marks room CLEAN
        App->>API: PATCH /api/rooms/:id/status (status: CLEAN)
        API->>DB: Update Room status to CLEAN
        API->>WS: Broadcast event: 'room:status:updated'
        WS-->>App: Gantt Matrix badge updates to Green (CLEAN)
    end

    %% Step 3: Invoicing & Checkout Workflow
    rect rgb(236, 253, 245)
        note over Reception, DB: 3. Billing & Folio Checkout Workflow
        Reception->>App: Selects Reservation & clicks "Generate Invoice"
        App->>API: POST /api/invoices/generate
        API->>DB: Calculate Dynamic Room Rate (pricePerNight ?? basePrice) + Ancillaries + Tax
        DB-->>API: Returns Generated Invoice DTO
        API-->>App: Display Invoice Folio Breakdown
        Reception->>App: Clicks "Process Payment & Mark Paid"
        App->>API: PATCH /api/invoices/:id/pay
        API->>DB: Update Invoice status = PAID
        DB-->>API: Confirmed
        API-->>App: Checkout Complete & Digital Receipt Ready
    end
```

---

## 📋 2. Sub-System Workflow Breakdown

### 🏨 A. Property Onboarding Workflow
```mermaid
graph LR
    A[Launch App] --> B[Register Screen]
    B -->|Submit Hotel Name, City, Owner Email| C[Express /api/auth/register]
    C -->|Bcrypt Password Hash| D[(PostgreSQL DB)]
    D -->|Create Chain + Property + Owner User| E[Return JWT Token]
    E --> F[Auto-seed Default Rooms & Categories]
    F --> G[Redirect to 2D Gantt Dashboard]
```

### 🚪 B. Room Creation & Dynamic Category / Pricing Workflow
```mermaid
graph TD
    A[Click '+' Add Room on 2D Gantt Grid] --> B[Open Add Room Modal]
    B -->|Optional: Click '+ Add New Category'| C[Enter Custom Category Name, Default Base Price, Description]
    C -->|POST /api/rooms/categories| D[Create Dynamic RoomCategory in PostgreSQL DB]
    B --> E[Enter Room Number e.g. 301, Custom Price ₹/night, Room Size/Specs]
    E --> F[Select Category & Initial Cleanliness Status]
    F --> G[Submit via POST /api/rooms]
    G --> H[Persist pricePerNight & roomSize in PostgreSQL DB]
    H --> I[Emit Socket.io Realtime Event]
    I --> J[Render Room Card with Dynamic Category, Price Rate & Size Badge on 2D Matrix]
```

### 📅 C. Booking & Concurrency Lock Workflow
```mermaid
graph TD
    A[Select Check-in & Check-out Dates] --> B[Fetch Available Rooms /api/rooms/available]
    B --> C[Fill Guest Details & Select Room with Dynamic Rate]
    C --> D{Database Overlap Check}
    D -->|No Overlap| E[Create Reservation Record]
    D -->|Overlap Detected| F[Return 409 Conflict Error]
    E --> G[Emit Socket.io Broadcast]
    G --> H[Update 2D Matrix UI across all devices]
```

### 🧹 D. Housekeeping Turnover Workflow
```mermaid
graph LR
    A[Guest Checkout] -->|Set Room DIRTY| B[Housekeeping Screen]
    B -->|Cleaning Staff Toggles Status| C[PATCH /api/rooms/:id/status]
    C -->|DB Status Log Updated| D[Emit room:status:updated]
    D -->|WebSockets| E[Dashboard Badge turns Green - CLEAN]
```

### 💳 E. Billing & Folio Checkout Workflow
```mermaid
graph TD
    A[Select Guest Reservation] --> B[Generate Invoice Request]
    B --> C[Fetch Room Dynamic Rate pricePerNight ?? basePrice + Ancillary Add-ons]
    C --> D[Calculate Tax & Total]
    D --> E[Display Itemized Invoice Folio]
    E --> F[Process Payment]
    F --> G[Mark Invoice PAID & Checkout Guest]
```

---

## ⚡ 3. Realtime Socket.io Event Registry

| Event Name | Trigger Source | Payload | Target Action |
| :--- | :--- | :--- | :--- |
| `reservation:created` | New Booking / OTA Webhook | `ReservationDTO` | Adds bar to 2D Gantt Matrix |
| `room:status:updated` | Housekeeping Toggle / Room Creation | `{ roomId, roomNumber, newStatus }` | Updates room cleanliness badge & list on 2D Matrix |
| `channel:synced` | Inbound Webhook Processed | `ChannelSyncLogDTO` | Updates OTA Hub audit logs |
