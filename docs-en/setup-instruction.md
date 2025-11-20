<!--
  Copyright (c) 2024-2025 Tarabanov Alexander Viktorovich
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

# Digital Legal Entity Application Setup Instructions

## 🚀 Complete System Initialization Process

This document describes the complete process of preparing the application for work with blockchain support, smart contracts, and access management system.

---

## Step 1: Software Installation

1. Clone the project repository to your local device
2. Run the application via Docker Compose or locally depending on configuration
3. Open the web application in browser: `http://localhost:9000` (production) or `http://localhost:5173` (dev mode)

---

## Step 2: Crypto Wallet Connection

1. Make sure you have a browser wallet installed (MetaMask, WalletConnect, or similar)
2. In the wallet, create or import an account with governance token
3. In the web application, click the **"Connect Wallet"** button
4. Select wallet type and confirm connection
5. After successful connection, you will see your account address in the top corner

---

## Step 3: Adding RPC Providers (Security → RPC Providers)

1. Go to **Settings** → **Security** tab
2. Find the **"RPC Providers"** section
3. Click the **"Add"** button
4. Fill out the form for each blockchain network you want to use:
   - **Network Name** (e.g.: Ethereum, Polygon, BSC)
   - **RPC URL** (connection link, example: `https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY`)
   - **Network ID** (Chain ID)
5. Click **"Save"** for each provider
6. The system will automatically verify connection correctness

> ⚠️ **Important**: Get API keys from providers (Alchemy, Infura, Quicknode, etc.) before adding

---

## Step 4: Multi-Deploy Smart Contract Setup

1. Go to **Settings** → **Blockchain** tab
2. Fill out the form
3. Click **"Launch Deploy"**

---

## Step 5: Deploy Completion and Contract Address Saving

1. Wait for deploy completion (depends on network, usually 30-120 seconds)
2. After successful completion, the **"Contract Management"** page will open
3. **Copy the deployed contract address** (usually looks like: `0x742d35Cc6634C0532925a3b844Bc...`)

---

## Step 6: Smart Contract Authentication Setup

1. Return to **Settings** → **Authentication** tab
2. In the **"Smart Contract Address"** field, paste the address copied in step 5
3. Set thresholds for access management:
   - **Minimum number of tokens for editing** (e.g.: 100 tokens)
   - **Minimum number of tokens for viewing** (e.g.: 1 token)

---

## Step 7: AI and Database Setup

1. Go to **Settings** → **AI** tab
2. Open the **"Database"** subsection
3. Replace default passwords
4. Click **"Generate New Encryption Key"**
   - The system will automatically create a cryptographic key
   - **Save the key in a secure place** (it will be needed for data recovery)

---

## Step 8: Internet Access Setup (Optional)

**If you need access to the web application from outside via internet:**

1. Go to **Settings** → **Server** tab
2. On the **Server** page, select **WEB SSH** or another suitable service
3. Fill out the form to migrate local application to a virtual device with:
   - **Public IP address**
   - **Connection to your domain name**
4. Click **"Publish"**
5. Wait for migration process completion

> ℹ️ **Note**: This step requires having a registered domain name and access to DNS settings

---

## Step 9: Legal Documents Setup for Personal Data Processing

### 9.1 Filling Company Legal Information

1. Go to **CRM** → **Content** section
2. Find and open the **"Company Legal Information"** form
3. Fill in all necessary fields:
   - **Full Organization Name** (legal name)
   - **Short Name**
   - **Legal Form** (LLC, sole proprietor, JSC, etc.)
   - **Legal Address**
   - **Actual Address** (if different)
   - **INN / OGRN / KPP** (registration data)
   - **Contact Information** (phone, email, website)
   - **Responsible Person for Personal Data Processing** (Full Name, position)
   - **Applicable Jurisdiction** (GDPR, CCPA, Russian legislation, etc.)
4. Click **"Save"**

> 💡 **Hint**: All entered data will automatically be inserted into all legal document templates

### 9.2 Working with Document Templates

1. In the **Content** section, go to the **"Templates"** subsection
2. Select necessary document templates required by regulators:
   - **Privacy Policy**
   - **User Agreement**
   - **Personal Data Processing Consent**
   - **Cookie Usage Policy**
3. For each template:
   - Click **"Preview"** to check automatically filled data
   - Edit specific data processing parameters if necessary
   - Select action:
     - **"Publish for Public Use"** — document will be available on the site
     - **"Publish for Internal Use"** — document available only within CRM
     - **"Print"** — export to PDF for printing or signing
4. Confirm publication
5. The system will automatically add documents to corresponding application pages

> ⚠️ **Important**: It is recommended to consult with a lawyer before publishing documents to ensure full compliance with legal requirements

---

## ✅ Application Ready to Work!

After completing all steps, your application is fully configured and ready to use.

**Next Steps:**
- 📖 AI Assistant Setup (see document: `setup-ai-assistant.md`)
- 🔐 Smart Contract Management (see document: `manage-smart-contracts.md`)

---

## 🆘 Security Recommendations

✓ Keep contract addresses and encryption keys in a secure place  
✓ Use strong passwords for DB  
✓ Regularly create configuration backups  
✓ Never share wallet private keys  
✓ Use HTTPS for application access in production  

---

## 📝 What's Next?

After completing basic setup, you can:
1. Add users and manage their permissions
2. Create groups for collaboration
3. Configure AI assistant for task automation
4. Manage smart contracts to extend functionality
5. Integrate external services and bots

---

## 📚 Additional Documentation

### Explore DLE Capabilities
- 🤖 **[AI Assistant](./ai-assistant.md)** - learn how AI can become a second pilot for your team
- 💼 **[Blockchain for Business](./blockchain-for-business.md)** - how asset tokenization solves business tasks
- 🛡️ **[Security](./security.md)** - multi-level protection for your business

### Technical Information
- 🔗 **[Blockchain Technical Documentation](./blockchain-integration-technical.md)** - for developers
- 📋 **[FAQ](./FAQ.md)** - frequently asked questions
- 📝 **[Application Description](./application-description.md)** - functionality overview

### Support
- 💬 **Support Chat**: https://hb3-accelerator.com/
- 📧 **Email**: info@hb3-accelerator.com

