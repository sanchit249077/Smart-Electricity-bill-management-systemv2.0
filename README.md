# SmartPower — Electricity Bill Management

A standalone full-stack electricity billing and energy-management web app built with React, Vite, Express, and a lightweight JSON data store.

**Created by Sanchit Nayyar**

## Features
- Customer registration and login
- Role-based customer, staff, and administrator access
- Electricity bills and local checkout/payment flow
- Consumption analytics and solar monitoring
- Appliance tracking
- Power outage reporting
- Complaints and staff responses
- Notifications
- Tariff management
- Theft/anomaly scanning
- Profile management
- Password reset links for local development

## Run in GitHub Codespaces

From the repository root:

```bash
npm install
npm run build
npm run codespace:start
```

The frontend runs on port **5173** and the local API runs on port **4400**. Codespaces can forward port 5173.

## Demo accounts

- Customer: `demo@smartpower.local` / `demo1234`
- Staff: `staff@smartpower.local` / `staff1234`
- Admin: `admin@smartpower.local` / `admin1234`

## Standalone architecture

The frontend talks to the Express API through `/api`. Application records are persisted in `server/data/db.json`. No external platform or standalone services are required.

## Useful commands

```bash
npm run build
npm run validate
npm run dev:full
npm start
```

`npm start` serves the already-built frontend and API together; `npm run dev:full` runs Vite and the API for development.
