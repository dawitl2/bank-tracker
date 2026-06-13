# 💳 Bank Tracker (Receipt & SMS-Based Expense Tracker)

A custom-built web application designed to track and organize Bank of Abyssinia transaction data using both receipt information and live account balance updates.

Originally developed as a **requested solution** for managing construction expenses within a shared family bank account, the system has evolved to include a companion Android application that automatically reads Bank of Abyssinia SMS notifications and provides real-time account balance updates.

---

## 📸 Screenshots

![Transactions View](./screenshot1.png)

![Balance & Analytics](./screenshot2.png)

![Balance & Analytic Desktop](./screenshot3.png)

---

## 🚀 Overview

This system allows users to:

* Track all transactions from a single bank account
* Separate spending by different individuals or groups
* Monitor withdrawals, deposits, and account balances
* View receipt details directly from links, QR codes, or images
* Analyze spending patterns through interactive dashboards
* Automatically receive the latest account balance from Bank of Abyssinia SMS notifications

---

## ⚙️ How It Works

### Receipt Tracking Flow

1. The system starts with a base balance.
2. Transactions are added using one of the following methods:

   * Receipt link
   * QR code scan
   * Image upload (OCR extraction)
3. The backend extracts transaction information from the receipt.
4. Data is stored in Supabase.
5. The application automatically:

   * Calculates withdrawals and deposits
   * Updates transaction history
   * Categorizes spending by person or group
   * Generates analytics and summaries

### SMS Balance Flow

1. The Android companion app listens for incoming Bank of Abyssinia SMS notifications.
2. Relevant account messages are automatically parsed.
3. The latest account balance information is securely sent to the backend.
4. The web dashboard displays:

   * Current account balance
   * Latest withdrawal amount
   * Latest deposit amount

The SMS integration serves as a live balance companion and does not replace the receipt-based transaction tracking system.

---

## 🎯 Key Features

### 🧾 Transaction Tracking

* Displays all transactions in a structured table
* Includes:

  * Amount
  * Date
  * Reference number
  * Narrative
* Direct access to original receipt information

---

### 🎨 Smart Categorization

Transactions are automatically grouped by person:

* 🟡 Construction Group
* 🔴 Project Groups
* ⚫ Individual Members
* ⚪ Other Transactions

Each category includes its own spending analysis and contribution breakdown.

---

### 💰 Balance System

Displays:

* Current balance
* Total withdrawals
* Total deposits
* Last transaction details
* Balance visibility toggle for privacy

---

### 📊 Advanced Analytics Dashboard

Includes:

* Monthly income vs spending trends
* Spending velocity analysis
* Cumulative spending curves
* Person/group contribution breakdowns
* Interest estimation tools
* Interactive charts and visualizations

---

### 📱 BOA SMS Companion Integration

A dedicated Android companion application provides real-time balance updates.

Features include:

* Automatic Bank of Abyssinia SMS detection
* Filtering of OTP and promotional messages
* Latest account balance tracking
* Latest withdrawal tracking
* Latest deposit tracking
* Secure synchronization with the backend

This integration allows the dashboard to display current account information even when a corresponding receipt is unavailable.

---

### 🔍 Receipt Intake System

The application supports multiple receipt ingestion methods.

#### 🔗 Link-Based Receipt Scraping

* Fetches transaction information from Bank of Abyssinia receipt URLs
* Backend extraction using Puppeteer

#### 📷 OCR Image Processing

* Uses Tesseract.js
* Extracts:

  * Amount
  * Date
  * Reference Number
  * Narrative

#### 📷 QR Code Scanning

* Browser-based QR scanning
* Live camera support
* Automatic receipt detection
* Smart camera selection
* Optional zoom controls

---

### 🧮 Built-in Calculator

* Quick-access calculator inside the dashboard
* Useful for on-the-fly financial calculations

---

### 🔐 Authentication System

* Password-protected login
* Session persistence
* Device-friendly access
* Reduced login repetition

---

### 🔐 Interest Lock Feature

Sensitive interest-related calculations remain hidden until unlocked.

Features:

* Encoded password verification
* Session-based access
* Secure visibility toggling

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Recharts
* Custom Responsive CSS
* Tesseract.js
* BarcodeDetector API

### Backend

* Node.js
* Express.js
* Puppeteer
* REST API Services

### Database

* Supabase (PostgreSQL)

### Mobile Companion

* Native Android Application
* SMS Broadcast Receivers
* Secure API Communication

### Deployment

* Vercel (Frontend)
* Render (Backend)
* Supabase (Database)

---

## 📱 Design Approach

* Mobile-first design
* Fully responsive layout
* Clean and lightweight interface
* Optimized for real-world daily usage
* Fast transaction lookup and analysis

---

## 📌 Project Context

This project was built as a custom solution to address a real-world problem:

Managing expenses from a shared bank account used by multiple individuals working on a construction project.

The objective was to create a system that is:

* Simple to use
* Visually clear
* Accurate in tracking
* Low-maintenance
* Flexible enough to handle multiple sources of transaction data

---

## 🔮 Future Improvements

* CSV / Excel exports
* Enhanced OCR accuracy
* Multi-user roles and permissions
* Additional bank integrations
* Improved mobile companion features
* Advanced financial reporting

---

## ⚠️ Notes

* Data accuracy depends on receipt format consistency.
* Receipt layout changes may require scraper updates.
* OCR and QR accuracy may vary depending on image quality and camera hardware.
* SMS integration depends on Android permissions and message format consistency.

---

## 👨‍💻 Author

Developed as a custom project for real-world financial tracking and expense management.

All data included in screenshots, examples, and repository samples are demonstration data only.