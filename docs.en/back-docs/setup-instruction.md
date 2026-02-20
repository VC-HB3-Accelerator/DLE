<!--
  Copyright (c) 2024-2025 Alexander Viktorovich Tarabanov
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

**English** | [Русский](../../docs.ru/back-docs/setup-instruction.md)

# Digital Legal Entity — Application Setup Guide

## Full system initialization

This document describes the full process of preparing the application for use with blockchain, smart contracts, and the access control system.

---

## Step 1: Install software

1. Clone the project repository to your machine
2. Run the application via Docker Compose or locally as per your setup
3. Open the web app in a browser: `http://localhost:9000` (production) or `http://localhost:5173` (dev)

---

## Step 2: Connect crypto wallet

1. Ensure a browser wallet is installed (MetaMask, WalletConnect, or similar)
2. Create or import an account that holds governance tokens
3. In the web app click **"Connect wallet"**
4. Choose wallet type and confirm connection
5. After success you will see your account address in the top corner

---

## Step 3: Add RPC providers (Security → RPC providers)

1. Go to **Settings** → **Security** tab
2. Find **"RPC providers"**
3. Click **"Add"**
4. For each blockchain network fill in:
   - **Network name** (e.g. Ethereum, Polygon, BSC)
   - **RPC URL** (e.g. `https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY`)
   - **Chain ID**
5. Click **"Save"** for each provider
6. The system will verify the connection

> ⚠️ **Important:** Obtain API keys from providers (Alchemy, Infura, QuickNode, etc.) before adding

---

## Step 4: Multichain smart contract deployment

1. Go to **Settings** → **Blockchain** tab
2. Fill in the form
3. Click **"Start deployment"**

---

## Step 5: Complete deployment and save contract address

1. Wait for deployment to finish (typically 30–120 seconds)
2. After success the **"Contract management"** page opens
3. **Copy the deployed contract address** (e.g. `0x742d35Cc6634C0532925a3b844Bc...`)

---

## Step 6: Configure authentication via smart contract

1. Return to **Settings** → **Authentication** tab
2. In **"Smart contract address"** paste the address from step 5
3. Set access thresholds:
   - **Minimum tokens for editing** (e.g. 100)
   - **Minimum tokens for viewing** (e.g. 1)

---

## Step 7: AI and database configuration

1. Go to **Settings** → **AI** tab
2. Open **"Database"** subsection
3. Change default passwords
4. Click **"Generate new encryption key"**
   - The system creates a cryptographic key
   - **Store the key securely** (needed for data recovery)

---

## Step 8: Internet access (optional)

If you need external access to the web app:

1. Go to **Settings** → **Server** tab
2. Select **WEB SSH** or another suitable service
3. Fill in the form to migrate the local app to a host with public IP and domain
4. Click **"Publish"**
5. Wait for migration to complete

> ℹ️ Requires a registered domain and DNS access

---

## Step 9: Legal documents for personal data

### 9.1 Company legal information

1. Go to **CRM** → **Content**
2. Open the **"Company legal information"** form
3. Fill in: full name, short name, legal form, legal address, actual address, Tax ID/OGRN/KPP, contacts, DPO responsible person, applicable jurisdiction (GDPR, CCPA, etc.)
4. Click **"Save"**

### 9.2 Document templates

1. In **Content** go to **"Templates"**
2. Select templates: Privacy Policy, User Agreement, Consent to data processing, Cookie policy
3. For each: **Preview**, edit if needed, then **Publish for public** / **Publish for internal** / **Print** (PDF)
4. Confirm; documents are added to the app

> ⚠️ Consult a lawyer before publishing to ensure legal compliance

---

## Application ready

After these steps the application is fully configured.

**Next:**
- AI assistant setup: see `setup-ai-assistant.md`
- Smart contract management: see `manage-smart-contracts.md`

---

## Security tips

✓ Store contract addresses and encryption keys securely  
✓ Use strong DB passwords  
✓ Back up configuration regularly  
✓ Never share wallet private keys  
✓ Use HTTPS in production  

---

## Documentation

- [AI Agents](../ai-assistant.md)
- [Blockchain for Business](../blockchain-for-business.md)
- [Security](../security.md)
- [Blockchain technical docs](./blockchain-integration-technical.md)
- [FAQ](../FAQ.md)
- [Application description](../application-description.md)

**Support:** https://hb3-accelerator.com/ | info@hb3-accelerator.com
