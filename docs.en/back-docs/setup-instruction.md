<!--
  Copyright (c) 2024-2026 Alexander Viktorovich Tarabanov
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

**English** | [Русский](../../docs.ru/back-docs/setup-instruction.md)

# Digital Legal Entity application setup guide

## 🚀 Full system initialization process

This document describes the full process of preparing the application for operation with blockchain support, smart contracts, and the access control system.

---

## Step 1: Software installation

1. Clone the project repository to your local device
2. Start the application via Docker Compose or locally depending on the configuration
3. Open the web application in the browser: `http://localhost:9000` (production) or `http://localhost:5173` (dev mode)

---

## Step 2: Connecting a crypto wallet

1. Make sure you have a browser wallet installed (MetaMask, WalletConnect, or similar)
2. In the wallet, create or import an account with the governance token
3. In the web application, click the **"Connect wallet"** button
4. Select the wallet type and confirm the connection
5. After a successful connection you will see your account address in the top corner

---

## Step 3: Adding RPC providers (Security → RPC providers)

1. Go to **Settings** → **Security** tab
2. Find the **"RPC providers"** section
3. Click the **"Add"** button
4. Fill in the form for each blockchain network you want to use:
   - **Network name** (for example: Ethereum, Polygon, BSC)
   - **RPC URL** (connection link, example: `https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY`)
   - **Network ID** (Chain ID)
5. Click **"Save"** for each provider
6. The system will automatically verify the connection

> ⚠️ **Important**: Obtain API keys from providers (Alchemy, Infura, Quicknode, etc.) before adding them

---

## Step 4: Configuring multichain smart contract deployment

1. Go to **Settings** → **Blockchain** tab
2. Fill in the form
3. Click **"Start deploy"**

---

## Step 5: Completing deployment and saving the contract address

1. Wait for deployment to finish (depends on the network, usually 30–120 seconds)
2. After successful completion, the **"Contract management"** page will open
3. **Copy the deployed contract address** (it usually looks like: `0x742d35Cc6634C0532925a3b844Bc...`)

---

## Step 6: Configuring authentication via smart contract

1. Return to **Settings** → **Authentication** tab
2. In the **"Smart contract address"** field, paste the address copied in step 5
3. Set thresholds for access control:
   - **Minimum token amount for editing** (for example: 100 tokens)
   - **Minimum token amount for viewing** (for example: 1 token)

---

## Step 7: Configuring AI and the database

1. Go to **Settings** → **AI** tab
2. Open the **"Database"** subsection
3. Replace the default passwords
4. Click **"Generate new encryption key"**
   - The system will automatically create a cryptographic key
   - **Store the key in a safe place** (you will need it to restore data)

---

## Step 8: Configuring internet access (optional)

**If you need access to the web application from outside via the internet:**

1. Go to **Settings** → **Server** tab
2. On the **Server** page, select **WEB SSH** or another suitable service
3. Fill in the form to migrate the local application to a virtual device with:
   - **A public IP address**
   - **Connection to your domain name**
4. Click **"Publish"**
5. Wait for the migration process to finish

> ℹ️ **Note**: This step requires a registered domain name and access to DNS settings

---

## Step 9: Configuring legal documents for personal data processing

### 9.1 Filling in the company’s legal information

1. Go to **CRM** → **Content** section
2. Find and open the **"Company legal information"** form
3. Fill in all required fields:
   - **Full organization name** (legal name)
   - **Short name**
   - **Legal form** (LLC, sole proprietor, JSC, etc.)
   - **Legal address**
   - **Actual address** (if different)
   - **TIN / registration IDs** (registration details)
   - **Contact details** (phone, email, website)
   - **Person responsible for personal data processing** (full name, position)
   - **Applicable jurisdiction** (GDPR, CCPA, Russian law, etc.)
4. Click **"Save"**

> 💡 **Tip**: All entered data is automatically substituted into all legal document templates

### 9.2 Working with document templates

1. In the **Content** section, go to the **"Templates"** subsection
2. Select the document templates required by regulators:
   - **Privacy policy**
   - **Terms of use**
   - **Consent to personal data processing**
   - **Cookie policy**
3. For each template:
   - Click **"Preview"** to check the automatically filled data
   - If needed, edit specific data-processing parameters
   - Choose an action:
     - **"Publish for public use"** — the document will be available on the site
     - **"Publish for internal use"** — the document is available only inside CRM
     - **"Print"** — export to PDF for printing or signing
4. Confirm publication
5. The system will automatically add the documents to the corresponding application pages

> ⚠️ **Important**: It is recommended to consult a lawyer before publishing documents to ensure full compliance with legal requirements

---

## ✅ The application is ready to use!

After completing all steps, your application is fully configured and ready for use.

**Next stages:**
- 📖 AI assistant setup (see document: `setup-ai-assistant.md`)
- 🔐 Smart contract management (see document: `manage-smart-contracts.md`)

---

## 🆘 Security recommendations

✓ Store contract addresses and encryption keys in a safe place  
✓ Use strong passwords for the DB  
✓ Regularly create configuration backups  
✓ Never share wallet private keys  
✓ Use HTTPS to access the application in production  

---

## 📝 What’s next?

After completing basic setup you can:
1. Add users and manage their permissions
2. Create groups for collaboration
3. Configure the AI assistant to automate tasks
4. Manage smart contracts to extend functionality
5. Integrate external services and bots

---

## 📚 Additional documentation

### Explore DLE capabilities
- 🤖 **[AI agents](../ai-assistant.md)** — a system for creating specialized agents for business processes
- 💼 **[Blockchain for business](../blockchain-for-business.md)** - how asset tokenization solves business tasks
- 🛡️ **[Security](../security.md)** - multi-layer protection for your business

### Technical information
- 🔗 **[Technical blockchain documentation](./blockchain-integration-technical.md)** - for developers
- 📋 **[FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md)** — frequently asked questions
- 📝 **[README](../../README.md)** — installation and product overview
- 📝 **[AI agents](../ai-assistant.md)** — agent functionality
- 📝 **[Blockchain for business](../blockchain-for-business.md)** — cases and tokenization
- 📝 **[Security](../security.md)** — protection model

### Support
- 💬 **Support chat**: https://hb3-accelerator.com/
- 📧 **Email**: info@hb3-accelerator.com
