Vue
Introduction
AppKit has support for Wagmi and Ethers v6 on Ethereum, @solana/web3.js on Solana and Bitcoin. Choose one of these to get started.

Installation
AppKit CLI
Reown offers a dedicated CLI to set up a minimal version of AppKit in the easiest and quickest way possible.

To do this, please run the command below.

npx @reown/appkit-cli

After running the command, you will be prompted to confirm the installation of the CLI. Upon your confirmation, the CLI will request the following details:

Project Name: Enter the name for your project.
Framework: Select your preferred framework or library. Currently, you have three options: React, Next.js, and Vue.
Network-Specific libraries: Choose whether you want to install Wagmi, Ethers, Solana, or Multichain (EVM + Solana).
After providing the project name and selecting your preferences, the CLI will install a minimal example of AppKit with your preferred blockchain library. The example will be pre-configured with a projectId that will only work on localhost.

To fully configure your project, please obtain a projectId from the Reown Cloud Dashboard and update your project accordingly.

Refer to this section for more information.

Custom Installation
Wagmi
Ethers
Ethers v5
Solana
Bitcoin
npm
Yarn
Bun
pnpm
yarn add @reown/appkit @reown/appkit-adapter-ethers ethers

Don't have a project ID?
Head over to Reown Cloud and create a new project now!

Get started
cloud illustration
Cloud Configuration
Create a new project on Reown Cloud at https://cloud.reown.com and obtain a new project ID.

Implementation
Wagmi
Ethers
Ethers v5
Solana
Bitcoin
GitHub
ethers Example
Check the Vue ethers example

In your App.vue file set up the following configuration.

<script setup lang="ts">
  import { createAppKit, useAppKit } from '@reown/appkit/vue'
  import { EthersAdapter } from '@reown/appkit-adapter-ethers'
  import { mainnet, arbitrum } from '@reown/appkit/networks'

  // 1. Get projectId from https://cloud.reown.com
  const projectId = 'YOUR_PROJECT_ID'

  // 2. Create your application's metadata object
  const metadata = {
    name: 'My Website',
    description: 'My Website description',
    url: 'https://mywebsite.com', // url must match your domain & subdomain
    icons: ['https://avatars.mywebsite.com/']
  }

  // 3. Create a AppKit instance
   createAppKit({
    adapters: [new EthersAdapter()],
    networks: [mainnet, arbitrum],
    metadata,
    projectId,
    features: {
      analytics: true // Optional - defaults to your Cloud configuration
    }
  })

  // 4. Use modal composable
  const modal = useAppKit()
</script>

<template> // Rest of your app ... </template>

IMPORTANT
Make sure that the url from the metadata matches your domain and subdomain. This will later be used by the Verify API to tell wallets if your application has been verified or not.

Trigger the modal
Wagmi
Ethers
Ethers v5
Solana
Bitcoin
To open AppKit you can use our web component or build your own button with the AppKit composables.

Web Components
Composables
<template>
  <appkit-button />
</template>

Learn more about the AppKit web components here

note
Web components are global html elements that don't require importing.

Smart Contract Interaction
Wagmi
Ethers
Solana
Ethers can help us interact with wallets and smart contracts:

<script setup lang="ts">
  import { useAppKitProvider, useAppKitAccount } from "@reown/appkit/vue";
  import { BrowserProvider, Contract, formatUnits } from 'ethers'

  const USDTAddress = '0x617f3112bf5397D0467D315cC709EF968D9ba546'

  // The ERC-20 Contract ABI, which is a common contract interface
  // for tokens (this is the Human-Readable ABI format)
  const USDTAbi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function balanceOf(address) view returns (uint)',
    'function transfer(address to, uint amount)',
    'event Transfer(address indexed from, address indexed to, uint amount)'
  ]

  function Components() {
    const { address, isConnected } = useAppKitAccount()
    const { walletProvider } = useAppKitProvider('eip155')

    async function getBalance() {
    if (!isConnected) throw Error('User disconnected')

    const ethersProvider = new BrowserProvider(walletProvider)
    const signer = await ethersProvider.getSigner()
    // The Contract object
    const USDTContract = new Contract(USDTAddress, USDTAbi, signer)
    const USDTBalance = await USDTContract.balanceOf(address)

    console.log(formatUnits(USDTBalance, 18))
  }
  return <button onClick={getBalance}>Get User Balance</button>
}
</script>

Composables
Composables are functions that will help you control the modal, subscribe to wallet events and interact with them and smart contracts.

useAppKit
Composable function for controlling the modal.

import { useAppKit } from '@reown/appkit/vue'

export default function Component() {
  const { open, close } = useAppKit()
}

Returns
open: Function to open the modal
close: Function to close the modal
Parameters
You can also select the modal's view when calling the open function

open({ view: 'Account' })

List of views you can select

Variable	Description
Connect	Principal view of the modal - default view when disconnected
Account	User profile - default view when connected
AllWallets	Shows the list of all available wallets
Networks	List of available networks - you can select and target a specific network before connecting
WhatIsANetwork	"What is a network" onboarding view
WhatIsAWallet	"What is a wallet" onboarding view
OnRampProviders	"On-Ramp main view
Swap	"Swap main view
useAppKitAccount
Composable function for accessing account data and connection status.

import { useAppKitAccount } from "@reown/appkit/vue";

export default Component(){
  const accountData = useAppKitAccount()
}

Returns
accountData.value.address: The current account address
accountData.value.caipAddress: The current account address in CAIP format
accountData.value.isConnected: Boolean that indicates if the user is connected
accountData.value.status: The current connection status
useAppKitNetwork
Composable function for accessing network data and methods.

import { useAppKitNetwork } from "@reown/appkit/vue";

export default Component(){
  const networkData = useAppKitNetwork()
}

Returns
networkData.caipNetwork: The current network object
networkData.caipNetworkId: The current network id in CAIP format
networkData.chainId: The current chain id
networkData.switchNetwork: Function to switch the network. Accepts a caipNetwork object as argument.
switchNetwork Usage
import { polygon } from '@reown/appkit/networks'

...

networkData.switchNetwork(polygon)

info
See how to import or create a networks here.

useAppKitState
Composable function for getting the current value of the modal's state.

import { useAppKitState } from '@reown/appkit/vue'

const stateData = useAppKitState()

Returns
stateData.open: Boolean that indicates if the modal is open
stateData.selectedNetworkId: The current chain id selected by the user
useAppKitTheme
Composable function for controlling the modal's theme.

import { useAppKitTheme } from '@reown/appkit/vue'
const themeAction = useAppKitTheme()
// or 
// const { setThemeMode, setThemeVariables } = useAppKitTheme()

Returns
themeAction.themeMode: Get theme Mode.
themeAction.themeVariables: Get theme variables.
themeAction.setThemeMode: Set theme Mode. Accepts a string as parameter ('dark' | 'light')
themeAction.setThemeVariables: Set theme variables. Check the example usage.
Example Usage
setThemeMode('dark')


setThemeVariables({
  '--w3m-color-mix': '#00BB7F',
  '--w3m-color-mix-strength': 40
})

useAppKitEvents
Composable function for subscribing to modal events.

import { useAppKitEvents } from '@reown/appkit/vue'

const events = useAppKitEvents()

Returns
events.timestamp: Get the timestamp of the event
events.data.event: Get string of the event.
events.data.properties: get more information from the event.
useDisconnect
Composable function for disconnecting the session.

import { useDisconnect } from '@reown/appkit/vue'

const { disconnect } = useDisconnect()

await disconnect()

useWalletInfo
Composable function for accessing wallet information.

import { useWalletInfo } from '@reown/appkit/vue'


export default Component(){
  const { walletInfo } = useWalletInfo()
}

Ethereum/Solana Library
Wagmi
Ethers
Ethers v5
Solana
useAppKitAccount
Hook that returns the client's information.

import { useAppKitAccount } from '@reown/appkit/vue'

const { address, status, isConnected } = useAppKitAccount()

switchNetwork
import { createAppKit } from '@reown/appkit/vue'
import { mainnet, arbitrum, polygon } from '@reown/appkit/networks'

const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [mainnet, arbitrum],
  metadata: metadata,
  features: {
    analytics: true,
  }
})

modal.switchNetwork(polygon)

useAppKitProvider
Hook that returns the walletProvider and the WalletProviderType.

import { BrowserProvider } from 'ethers'
import { useAppKitProvider } from '@reown/appkit/vue'

function Components() {
  const { walletProvider } = useAppKitProvider('eip155')

  async function onSignMessage() {
    const provider = new BrowserProvider(walletProvider)
    const signer = await provider.getSigner()
    const signature = await signer?.signMessage('Hello AppKit Ethers')
    console.log(signature)
  }

  return <button onClick={() => onSignMessage()}>Sign Message</button>
}

getError
function Components() {
  const error = modal.getError();
  //...
}

Options
Options
The following options can be passed to the createAppKit function:

createAppKit({ adapters, projectId, networks, ...options })

networks
Array of networks that can be chosen from the @reown/appkit/networks library. This library retrieves the list of EVM networks from Viem and also includes the Solana networks.

import { mainnet, solana } from '@reown/appkit/networks'

createAppKit({
  // ...
  networks: [mainnet, solana]
})

For custom networks, refer to this doc page.

metadata
Metadata for your AppKit. The name, description, icons, and url are used at certain places like the wallet connection, sign message, etc screens. If not provided, they will be fetched from the metadata of your website's document object.

createAppKit({
  // ...
  metadata: {
    name: 'My App',
    description: 'My App Description',
    icons: ['https://myapp.com/icon.png'],
    url: 'https://myapp.com'
  }
})

For custom networks, refer to this doc page.

defaultNetwork
Desired network for the initial connection as default:

Wagmi
Ethers
Solana
const mainnet = {
  chainId: 1,
  name: 'Ethereum',
  currency: 'ETH',
  explorerUrl: 'https://etherscan.io',
  rpcUrl: 'https://cloudflare-eth.com'
}

createAppKit({
  //...
  defaultNetwork: mainnet
})

defaultAccountTypes
It allows you to configure the default account selected for the specified networks in AppKit. For example, if you want your EVM networks to use an EOA account by default, you can configure it as shown in the code below.

createAppKit({
  //...
  defaultAccountTypes: {eip155:'eoa'}
})

Here are all the options you have for each network identifier or networks. Network identifier or networks available are eip155 for EVM chains, solana for Solana, bip122 for Bitcoin, and polkadot for Polkadot.

type DefaultAccountTypes = {
    eip155: "eoa" | "smartAccount";
    solana: "eoa";
    bip122: "payment" | "ordinal" | "stx";
    polkadot: "eoa";
}

featuredWalletIds
Select wallets that are going to be shown on the modal's main view. Default wallets are MetaMask and Trust Wallet. Array of wallet ids defined will be prioritized (order is respected). These wallets will also show up first in All Wallets view. You can find the wallets IDs in Wallets List or in WalletGuide

createAppKit({
  //...
  featuredWalletIds: [
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
  ]
})

chainImages
Add or override the modal's network images.

createAppKit({
  // ...
  chainImages: {
    1: 'https://my.images.com/eth.png'
  }
})

connectorImages
Wagmi
Ethers
Solana
Set or override the images of any connector.

createAppKit({
  connectorImages: {
    coinbaseWallet: 'https://images.mydapp.com/coinbase.png',
    walletConnect: 'https://images.mydapp.com/walletconnect.png'
  }
})

enableWalletConnect
Enable or disable WalletConnect QR feature. Default is true.

enableWalletConnect: false

debug
Enable or disable debug mode in your AppKit. This is useful if you want to see UI alerts when debugging. Default is false.

debug: true

termsConditionsUrl
You can add an url for the terms and conditions link.

createAppKit({
  //...
  termsConditionsUrl: 'https://www.mytermsandconditions.com'
})

privacyPolicyUrl
A URL for the privacy policy link.

createAppKit({
  //...
  privacyPolicyUrl: 'https://www.myprivacypolicy.com'
})

features
Allows you to toggle (enable or disable) additional features provided by AppKit. Features such as analytics, email and social logins, On-ramp, swaps, etc., can be enabled using this parameter.

analytics
Enable analytics to get more insights on your users activity within your Reown Cloud's dashboard

createAppKit({
  //...
  features: {
    analytics: true
  }
})

Learn More
swaps
Enable or disable the swap feature in your AppKit. Swaps feature is enabled by default.

createAppKit({
  //...
  features: {
    swaps: true
  }
})

onramp
Enable or disable the onramp feature in your AppKit. Onramp feature is enabled by default.

createAppKit({
  //...
  features: {
    onramp: true
  }
})

connectMethodsOrder
Order of the connection methods in the modal. The default order is ['wallet', 'email', 'social'].


createAppKit({
  //...
  features: {
    connectMethodsOrder: ['social', 'email', 'wallet'],
  }
})

legalCheckbox
Enable or disable the terms of service and/or privacy policy checkbox.

createAppKit({
  //...
  features: {
    legalCheckbox: true
  }
})


customWallets
Adds custom wallets to the modal. customWallets is an array of objects, where each object contains specific information of a custom wallet.

createAppKit({
  //...
  customWallets: [
    {
      id: 'myCustomWallet',
      name: 'My Custom Wallet',
      homepage: 'www.mycustomwallet.com', // Optional
      image_url: 'my_custom_wallet_image', // Optional
      mobile_link: 'mobile_link', // Optional - Deeplink or universal
      desktop_link: 'desktop_link', // Optional - Deeplink
      webapp_link: 'webapp_link', // Optional
      app_store: 'app_store', // Optional
      play_store: 'play_store' // Optional
    }
  ]
})

AllWallets
caution
If the "All Wallets" button is removed on mobile, all the mobile wallets that were not added on the main view of the modal won't be able to connect to your website via WalletConnect protocol.

The allWallets parameter allows you to add or remove the "All Wallets" button on the modal.

Value	Description
SHOW	Shows the "All Wallets" button on AppKit.
HIDE	Removes the "All Wallets" button from AppKit.
ONLY_MOBILE	Shows the "All Wallets" button on AppKit only on mobile.
createAppKit({
  //...
  allWallets: 'ONLY_MOBILE'
})

includeWalletIds & excludeWalletIds
caution
Wallets that are either not included or excluded won't be able to connect to your website on mobile via WalletConnect protocol.

includeWalletIds
Override default recommended wallets that are fetched from WalletGuide. Array of wallet ids defined will be shown (order is respected). Unlike featuredWalletIds, these wallets will be the only ones shown in All Wallets view and as recommended wallets. You can find the wallets IDs in our Wallets List.

createAppKit({
  //...
  includeWalletIds: [
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
  ]
})

excludeWalletIds
Exclude wallets that are fetched from WalletGuide. Array of wallet ids defined will be excluded. All other wallets will be shown in respective places. You can find the wallets IDs in our Wallets List.

createAppKit({
  //...
  excludeWalletIds: [
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
  ]
})

Coinbase Smart Wallet
The Coinbase connector now includes a new flag to customize the Smart Wallet behavior.

Note
To enable the Coinbase Smart Wallet feature, ensure that AppKit is updated to version 4.2.3 or higher. Additionally, if you are using Wagmi, verify that it is on the latest version.

The preference (or coinbasePreference) flag accepts one of the following string values:

eoaOnly: Uses EOA Browser Extension or Mobile Coinbase Wallet.
smartWalletOnly: Displays Smart Wallet popup.
all (default): Supports both eoaOnly and smartWalletOnly based on context.
Wagmi
Ethers
createAppKit({
  //...
  enableCoinbase: true, // true by default
  coinbasePreference: 'smartWalletOnly'
})

Web Components
AppKit's web components are custom and reusable HTML tags. They will work across modern browsers, and can be used with any JavaScript library or framework that works with HTML.

info
Web components are global html elements that don't require importing.

List of optional properties for AppKit web components
<appkit-button />
Variable	Description	Type
disabled	Enable or disable the button.
boolean
balance	Show or hide the user's balance.
'show' or 'hide'
size	Default size for the button.
'md' or 'sm'
label	The text shown in the button.
string
loadingLabel	The text shown in the button when the modal is open.
string
<appkit-account-button />
Variable	Description	Type
disabled	Enable or disable the button.
boolean
balance	Show or hide the user's balance.
'show' or 'hide'
<appkit-connect-button />
Variable	Description	Type
size	Default size for the button.
'md' or 'sm'
label	The text shown in the button.
string
loadingLabel	The text shown in the button when the modal is open.
string
<appkit-network-button />
Variable	Description	Type
disabled	Enable or disable the button.
boolean

Email & Socials
To allow users to authenticate using their email or social accounts, you need to configure the features parameter in the createAppKit function.

Wagmi
Ethers
Solana
const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [mainnet, arbitrum],
  metadata,
  features: {
    email: true, // default to true
    socials: ['google', 'x', 'github', 'discord', 'apple', 'facebook', 'farcaster'],
    emailShowWallets: true, // default to true
  },
  allWallets: 'SHOW', // default to SHOW
})

info
AppKit with ethers v5 does not support the auth parameter and social logins. If you're using ethers v5, please consider upgrading to ethers v6 following this ethers migration guide and AppKit Docs

Options
email [boolean] : This boolean defines whether you want to enable email login. Default true
socials [array] : This array contains the list of social platforms that you want to enable for user authentication. The platforms in the example include Google, X, GitHub, Discord, Apple, Facebook and Farcaster. The default value of undefined displays everything. Set it to false to disable this feature. You can also pass an empty array to disable it.
emailShowWallets [boolean] : This boolean defines whether you want to show the wallet options on the first connect screen. If this is false and socials are enabled, it will show a button that directs you to a new screen displaying the wallet options. Default true
User flow
Users will be able to connect to you application by simply using an email address. AppKit will send to them a One Time Password (OTP) to copy and paste in the modal, which will help to verify the user's authenticity. This will create a non-custodial wallet for your user which will be available in any application that integrates AppKit and email login.

Eventually the user can optionally choose to move from a non-custodial wallet to a self-custodial one by pressing "Upgrade Wallet" on AppKit. This will open the (WalletConnect secure website) that will walk your user through the upgrading process.

UI Variants
AppKit SDK offers multiple UI variants to customize the user experience for the authentication process.

By configuring the emailShowWallets option in the features parameter, you can control the initial connect screen behavior:

emailShowWallets: true: When this option is enabled, the initial connect screen will display the available wallet options directly to the user. This allows users to choose their preferred wallet immediately.


emailShowWallets: false: If this option is disabled, the initial connect screen will show a button instead. When the user clicks this button, they will be directed to a new screen that lists all the available wallet options. This can help simplify the initial interface and reduce visual clutter.


By configuring the socials option in the features parameter, you can control the amount of social providers you want to show on the connect screen:

socials: ['google']: When you only set one social provider, it will give you a button with `connect with provider.


socials: ['google', 'discord']: When you set 2 social provider, it will give you 2 buttons next to each other with the logo of the social provider


 socials: ['google', 'x', 'discord', 'apple', 'github']: When you set more than 2 social providers, the first provider in the array will get a button with connect with provider. The other providers will get a button with the logo of the social provider next to each other.


socials: [] or socials: false: When you want to disable social logins.


 email: false: When you want to disable email login.


By configuring the allWallets option inside the createAppKit function, you can control whether if and when you want to display all wallets.

allWallets: 'HIDE': When you do not want to display all wallets.


allWallets: 'SHOW': When you want to display all wallets.


allWallets: 'ONLY_MOBILE': When you want to display all wallets only on a mobile device.

Smart Accounts
Overview
note
💡 Ensure you update AppKit to the latest version for optimal compatibility.

Smart Accounts (SAs) are enabled by default within AppKit. These accounts enhance functionality by emitting 1271 and 6492 signatures, which should be taken into account for signature verification processes, such as Sign-In with Ethereum (SIWE).

Deployment
Smart Accounts are deployed alongside the first transaction. Until deployment, a precalculated address, known as the counterfactual address, is displayed. Despite not being deployed, the account can still sign using 6492 signatures.

Supported Networks
Smart Accounts are available on the following networks:

Base Sepolia
BSC (Binance Smart Chain)
Fraximal
Linea
Mode
Optimism
Polygon
Polygon Mumbai
Sepolia
User Eligibility
Smart Accounts are exclusively available for embedded wallet users (email and social login)

FAQ
What is a Smart Account?
A Smart Account improves the traditional account experience by replacing Externally Owned Accounts (EOAs) with a Smart Contract that follows the ERC-4337 standard. This opens up many use cases that were previously unavailable.

Smart Accounts do no require Private Keys or Seed Phrases, instead they rely on a key or multiple keys from designated signers to access the smart account and perform actions on chain. The keys can take multiple forms including passkeys and EOA signatures.

What can I do with a Smart Account?
Smart accounts unlock a host of use cases that were previously unavailable with EOAs. Essentially anything that can be programmed into a smart contract can be used by Smart Accounts.

Automated Transactions: Set up recurring payments or conditional transfers.
Multi-Signature Authorization: Require multiple approvals for a transaction to increase security.
Delegated Transactions: Allow a third party to execute transactions on your behalf under specific conditions.
Enhanced Security: Implement complex security mechanisms such as time-locked transactions and withdrawal limits.
Interoperability: Interact seamlessly with decentralized applications (dApps) and decentralized finance (DeFi) protocols.
Custom Logic: Create custom transaction rules and workflows that align with personal or business requirements.
How do I get a Smart Account?
Existing AppKit Universal Wallet Users will be given the option to upgrade their account to a smart account. Once you upgrade you will still be able to access your EOA and self-custody your account.

New AppKit Universal Wallet Users will be given smart accounts by default when they login for the first time.

Does it cost anything?
There is a small additional cost for activating your smart account. The activation fee is added to the first transaction and covers the network fees required for deploying the new smart contract onchain.

Can I export my Smart Account?
No, you cannot export your Smart Account. The Smart Account (SA) is deployed by the EOA and is owned by the EOA. Your EOA account will always be exportable. Also is good to know that SA don't have seedphrases.

Can I withdraw all my funds from my Smart Account?
Yes, you can withdraw all your funds from your Smart Account.

What are account names?
Smart account addresses start with ’0x’ followed by 42 characters, this is the unique address of your smart account on the network. ‘0x’ addresses like this are long, unwieldy and unmemorable. AppKit allows you to assign a more memorable name for your smart account using ENS Resolvers.

You can assign a name to your account and this will act as an alias for your account that can be shared publicly and provide a better user experience. AppKit account names are followed by the "reown.id" domain.

What can I do with my account name?
As AppKit smart account addresses are the same across the supported networks by Pimlico, you only need one account name which can then be used across the networks.

For example if you want someone to send you USDC on Polygon they can send it to “johnsmith.reown.id”. If you want someone wants to send you USDC on Optimism they can also use “johnsmith.reown.id”.

Custom networks
If you cannot find the network you are looking for within the @reown/appkit/networks path, you can always add a custom network.

Since AppKit v1.1.0, there are two ways to add your network to AppKit:

1. Adding Your Chain to Viem’s Directory (Recommended)
Reown AppKit use Viem to provide EVM chains to users under the hood. If your chain is EVM-compatible, it is recommended to open a PR to Viem to add your network to Viem’s directory. Once your chain is accepted by Viem, it will automatically be available in AppKit with no additional steps required.

Here is the documentation of how to add new chain to Viem: https://github.com/wevm/viem/blob/main/.github/CONTRIBUTING.md#chains

2. Creating a Custom Chain Object
You can also create a custom network object without waiting for approval from Viem’s repository.

Required Information

You will need the following values to create a custom network:

id: Chain ID of the network.
name: Name of the network.
caipNetworkId: CAIP-2 compliant network ID.
chainNamespace: Chain namespace.
nativeCurrency: Native currency of the network.
rpcUrls: Object containing the RPC URLs for the network.
blockExplorers: Object containing the block explorers for the network.
import { defineChain } from '@reown/appkit/networks';

// Define the custom network
const customNetwork = defineChain({
  id: 123456789,
  caipNetworkId: 'eip155:123456789',
  chainNamespace: 'eip155',
  name: 'Custom Network',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['RPC_URL'],
      webSocket: ['WS_RPC_URL'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'BLOCK_EXPLORER_URL' },
  },
  contracts: {
    // Add the contracts here
  }
})

// Then pass it to the AppKit
createAppKit({
    adapters: [...],
    networks: [customNetwork],
    chainImages: { // Customize networks' logos
      123456789: '/custom-network-logo.png', // <chainId>: 'www.network.com/logo.png'
    }
})


Sign In With Ethereum
AppKit provides a simple solution for integrating with "Sign In With Ethereum" (SIWE), a new form of authentication that enables users to control their digital identity with their Ethereum account. SIWE is a standard also known as EIP-4361.

One-Click Auth
One-Click Auth represents a key advancement within WalletConnect v2, streamlining the user authentication process in AppKit by enabling them to seamlessly connect with a wallet and sign a SIWE message with just one click.

Connecting a wallet, proving control of an address with an off-chain signature, authorizing specific actions. These are the kinds of authorizations that can be encoded as "ReCaps". ReCaps are permissions for a specific website or dapp that can be compactly encoded as a long string in the message you sign and translated by any wallet into a straight-forward one-sentence summary. WalletConnect uses permissions expressed as ReCaps to enable a One-Click Authentication.

Installation
One-Click Auth
Legacy
npm
Yarn
Bun
pnpm
yarn add @reown/appkit-siwe siwe

Configure your SIWE Client
One-Click Auth
Legacy
info
If you are not using our library on the server-side, please normalize the address with eip-55 in the createMessage function. You can check our example for that Functionality.

import { SiweMessage } from 'siwe'
import {
    type SIWESession,
    type SIWEVerifyMessageArgs,
    type SIWECreateMessageArgs,
    createSIWEConfig,
    formatMessage,
  } from '@reown/appkit-siwe'

const BASE_URL = 'http://localhost:8080';

/* Function that returns the user's session - this should come from your SIWE backend */
async function getSession(){
   const res = await fetch(BASE_URL + "/session", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: 'include',
  });
  if (!res.ok) {
      throw new Error('Network response was not ok');
  }
  
  const data = await res.json();
  
  const isValidData = typeof data === 'object' && typeof data.address === 'string' && typeof data.chainId === 'number';

  return isValidData ? data as SIWESession : null;
}

/* Use your SIWE server to verify if the message and the signature are valid */
 const verifyMessage = async ({ message, signature }: SIWEVerifyMessageArgs) => {
    try {
        const response = await fetch(BASE_URL + "/verify", {
            method: "POST",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify({ message, signature }),
            credentials: 'include'
        });

        if (!response.ok) {
            return false;
        }
        
        const result = await response.json();
        return result === true;
      } catch (error) {
        return false;
      }
}

// Check the full example for signOut and getNonce functions ... 

/* Create a SIWE configuration object */
export const siweConfig = createSIWEConfig({
  getMessageParams: async () => ({
    domain: window.location.host,
    uri: window.location.origin, 
    chains: [1, 2020],
      statement: 'Please sign with your account',
  }),
  createMessage: ({ address, ...args }: SIWECreateMessageArgs) => formatMessage(args, address),

  getNonce: async () => { //This is only an example, substitute it with your actual nonce getter.
    const nonce = "YOUR_NONCE_GETTER"
    if (!nonce) {
      throw new Error('Failed to get nonce!')
    }
    return nonce
  },
  getSession,
  verifyMessage,
  signOut: async () => { //Example
    // Implement your Sign out function
  }
});


Server Side
Setting up a backend server using Express for a web application that interacts with the Siwe protocol.

Routes:
GET '/nonce': Generates and returns a nonce (single-use random number).
POST '/verify': Uses the Siwe protocol to verify the message, requiring a signature (the one you are going to approve throw the UX) and a nonce stored in the session.
GET '/session': Retrieves the stored Siwe object from the session.
GET '/signout': Clears the session.
import cors from 'cors';
import express from 'express';
import Session from 'express-session';
import { generateNonce } from 'siwe';
import {
  /*verifySignature,*/
  getAddressFromMessage,
  getChainIdFromMessage,
} from '@reown/appkit-siwe'
import { createPublicClient, http } from 'viem'

const app = express();

const projectId = 'YOUR_PROJECT_ID';

// configure cors and sessions
app.use(cors({
  origin: 'http://localhost:5173', // frontend URL
  credentials: true,
}))
app.use(express.json())
app.use(Session({
  name: 'siwe-quickstart',
  secret: "siwe-quickstart-secret",
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false, sameSite: true }
}));

app.get('/nonce', function (_, res) {
    res.setHeader('Content-Type', 'text/plain');
    res.send(generateNonce());
});

// verify the message
app.post('/verify', async (req, res) => {
    try {
      if (!req.body.message) {
        return res.status(400).json({ error: 'SiweMessage is undefined' });
      }

      // save the session with the address and chainId (SIWESession)
      req.session.siwe = { address, chainId };
      req.session.save(() => res.status(200).send(true));

      
      const message = req.body.message;
      const signature = req.body.signature;
      const address = getAddressFromMessage(message);
      let chainId = getChainIdFromMessage(message);
      
      // for the moment, the verifySignature is not working with social logins and emails  with non deployed smart accounts  
      // for this reason we recommend using the viem to verify the signature
      const publicClient = createPublicClient(
        {
          transport: http(
            `https://rpc.walletconnect.org/v1/?chainId=${chainId}&projectId=${projectId}`
          )
        }
      );
      const isValid = await publicClient.verifyMessage({
        message,
        address,
        signature
      });
      if (!isValid) {
        // throw an error if the signature is invalid
        throw new Error('Invalid signature');
      }
      if (chainId.includes(":")) {
        chainId = chainId.split(":")[1];
      }
      
      // Convert chainId to a number
      chainId = Number(chainId);

      if (isNaN(chainId)) {
          throw new Error("Invalid chainId");
      }
      
      // save the session with the address and chainId (SIWESession)
      req.session.siwe = { address, chainId };
      req.session.save(() => res.status(200).send(true));
    } catch (e) {
      // clean the session
      req.session.siwe = null;
      req.session.nonce = null;
      req.session.save(() => res.status(500).json({ message: e.message }));
    }
  });

  /// ... check the github repository for the others endpoints

  // get the session
  app.get('/session', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(req.session.siwe);
  });  


Check the github full example to see the full flow working: siwe-quickstart

verifySignature
Verify a SIWE signature.

import { createPublicClient, http } from 'viem'

const publicClient = createPublicClient(
  {
    transport: http(
      `https://rpc.walletconnect.org/v1/?chainId=${chainId}&projectId=${projectId}`
    )
  }
);
const isValid = await publicClient.verifyMessage({
  message,
  address: address as `0x${string}`,
  signature: signature as `0x${string}`
});

// The verifySignature is not working with social logins and emails with non deployed smart accounts 
// for this reason we recommend using the viem to verify the signature
// import { verifySignature } from '@reown/appkit-siwe'
// const isValid = await verifySignature({ address, message, signature, chainId, projectId })

Initialize AppKit with your siweConfig
// Pass your siweConfig inside the createAppKit() function
  const modal = createAppKit({
      adapters: [wagmiAdapter], //or your Ethers adapter
      projectId,
      networks: [mainnet, arbitrum],
      defaultNetwork: mainnet,
      features: {
        analytics: true, // Optional - defaults to your Cloud configuration
      },
      siweConfig: siweConfig // pass your siweConfig
  })

SIWE Config Parameters
One-Click Auth
Legacy
getMessageParams () => Promise<{ domain: string, uri: string, chains: number[], statement: string }>
Parameters to create the SIWE message internally.

getNonce () => Promise<string>
The getNonce method functions as a safeguard against spoofing, akin to a CSRF token. The siwe package provides a generateNonce() helper, or you can utilize an existing CSRF token from your backend if available.

createMessage (args: SIWECreateMessageArgs) => string
The official siwe package offers a straightforward method for generating an EIP-4361-compatible message, which can subsequently be authenticated using the same package. The nonce parameter is derived from your getNonce endpoint, while the address and chainId variables are sourced from the presently connected wallet.

verifyMessage (args: SIWEVerifyMessageArgs) => Promise<boolean>
The function to ensure the message is valid, has not been tampered with, and has been appropriately signed by the wallet address.

getSession () => Promise<SIWESession | null>
The backend session should store the associated address and chainId and return it via the getSession method.

signOut () => Promise<boolean>
The users session can be destroyed calling signOut.

onSignIn (session?: SIWESession) => void
Callback when user signs in (Optional).

onSignOut () => void
Callback when user signs out (Optional).

signOutOnDisconnect boolean
defaults to true
Whether or not to sign out when the user disconnects their wallet (Optional).

Multichain
AppKit is now multichain. The architecture is designed to support both EVM and non-EVM blockchains. This will allow developers and projects to choose and configure multiple blockchain networks within their instance of AppKit, extending beyond just Ethereum-based (EVM) networks.

Currently, AppKit supports two non-EVM networks, they are, Solana and Bitcoin. Soon, AppKit will support Polkadot and Cosmos, allowing projects to tap into users from these different blockchain ecosystems. This will enable developers and projects to reach a broader audience and interact with multiple blockchain networks, all through a single wallet provider.

Installation
Wagmi + Solana
Wagmi + Bitcoin
Ethers + Solana
Ethers5 + Solana
Basic
npm
Yarn
Bun
pnpm
yarn add @reown/appkit @reown/appkit-adapter-wagmi @reown/appkit-adapter-solana @solana/wallet-adapter-wallets

Integration
The AppKit instance allows you to support multiple chains by importing the respective chains, creating the respective network adapters and passing these within the createAppKit() function.

Depending on the network adapter of your preference (Wagmi, Ethers, Ethers5), the integration may vary. Let's look at what the integration will look like.

Wagmi + Solana
Wagmi + Bitcoin
Ethers + Solana
Ethers5 + Solana
Basic
import { createAppKit } from '@reown/appkit'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'

import { mainnet, arbitrum, sepolia, solana, solanaTestnet, solanaDevnet } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/types'

import { SolflareWalletAdapter, PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, arbitrum, sepolia, solana, solanaTestnet, solanaDevnet]

// 0. Get projectId from https://cloud.reown.com
const projectId = 'YOUR_PROJECT_ID'

// 1. Create the Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId, 
  networks
})

// 2. Create Solana adapter
const solanaWeb3JsAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()]
})

// 3. Set up the metadata - Optional
const metadata = {
  name: 'AppKit',
  description: 'AppKit Example',
  url: 'https://example.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

// 4. Create the AppKit instance
const modal = createAppKit({
  adapters: [wagmiAdapter, solanaWeb3JsAdapter],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true,
  }
})


Theming
The theme for the AppKit integration in your dApp can be fully customized. Below are some examples:

Wormfare
BeraPong
ThemeMode
By default themeMode option will be set to user system settings 'light' or 'dark'. But you can override it like this:

createAppKit({
  //...
  themeMode: 'light'
})

themeVariables
By default themeVariables are undefined. You can set them like this:

createAppKit({
  //...
  themeVariables: {
    '--w3m-color-mix': '#00BB7F',
    '--w3m-color-mix-strength': 40
  }
})

The following list shows the theme variables you can override:

Variable	Description	Type
--w3m-font-family	Base font family
string
--w3m-accent	Color used for buttons, icons, labels, etc.
string
--w3m-color-mix	The color that blends in with the default colors
string
--w3m-color-mix-strength	The percentage on how much "--w3m-color-mix" should blend in
number
--w3m-font-size-master	The base pixel size for fonts.
string
--w3m-border-radius-master	The base border radius in pixels.
string
--w3m-z-index	The z-index of the modal.
number

Smart Sessions
Overview
note
💡 The support for smart-session is included in the Appkit SDK in the experimental package.

Smart Sessions allow developers to easily integrate session-based permission handling within their decentralized applications (dApps). Using the grantPermissions method, can send permission requests to wallets.

For users, this means a simpler experience. Instead of approving every action individually, they can allow access for a single session, making it faster and easier to use apps without dealing with constant pop-ups or interruptions.

With Smart Sessions, approved actions are carried out by the app's backend during the session. This allows transactions to be processed automatically, making the experience even more seamless while ensuring that everything stays within the permissions set by the user.

This guide will walk you through on how to use the grantPermissions method, including the basic setup and an example of how to request permissions from a wallet.

Implementations
The grantPermissions method provides an easy way to interact with the smart wallet to request permissions.

Step 1 | Install the library
npm
Yarn
Bun
pnpm
yarn add @reown/appkit-experimental

Step 2 | Import the method
First, import the grantPermissions method from the @reown/appkit-experimental/smart-session package.

import { grantPermissions, type SmartSessionGrantPermissionsRequest } from '@reown/appkit-experimental/smart-session'


Step 3 | Define the Permission Request
Create an object adhering to the SmartSessionGrantPermissionsRequest type. This object specifies details like the address, chainID, signer, policies, permissions, and expiry time.

Example request object:

const request: SmartSessionGrantPermissionsRequest = {
      expiry: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      chainId: toHex(baseSepolia.id),
      address: address,
      signer: {
        type: 'keys',
        data: {
          keys :[{
          type: 'secp256k1',
          publicKey: '0x...' //public key of dapp signer
        }]
        }
      },
      permissions: [ {
        type: 'contract-call',
        data: {
          address: '0x2E65BAfA07238666c3b239E94F32DaD3cDD6498D', // sample donut contract address
          abi: [
            {
              inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
              name: 'purchase',
              outputs: [],
              stateMutability: 'payable',
              type: 'function'
            }
          ],
          functions: [ {
            functionName: 'purchase'
          } ]
        }
      }],
      policies: []
    }

Step 4 | Invoke the Method
Call the grantPermissions function, passing the request object. This will trigger the permission request via the connected wallet.

 const response = await grantPermissions(request)

Step 5 | Handle the Response
Upon successful execution, the response will include the granted permissions and the session context. So the response can be handled as needed.

Response Format
{
  chainId: `0x14a34`
  address: `0x...`
  expiry: 1727824386
  permissions: [
    {
      type: 'contract-call',
      data: {
        address: '0x2E65BAfA07238666c3b239E94F32DaD3cDD6498D', // sample donut contract address
        abi: [
          {
            inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
            name: 'purchase',
            outputs: [],
            stateMutability: 'payable',
            type: 'function'
          }
        ],
        functions: [ {
          functionName: 'purchase'
        } ]
      }
    }
  ],
  context: '...'  // Context identifier for the session
}

How to use the permissions
The dApp must call the following two endpoints from the wallet services API to use these permissions.

https://rpc.walletconnect.org/v1/wallets/prepareCalls - Accepts an EIP-5792 wallet_sendCalls request. Responds with the prepared calls (in the case of Appkit Embedded Wallet, an Entrypoint v0.7 user operation), some context, and a signature request.
https://rpc.walletconnect.org/v1/wallets/sendPreparedCalls - Accepts prepared calls, a signature, and the context returned from prepareCalls if present. Returns an EIP-5792 calls ID.
Steps to follow for executing any async action by the dApp backend.

Dapp makes the wallet_prepareCalls JSON RPC call to the wallet service API. Accepts an EIP-5792 wallet_sendCalls request, and returns the prepared calls according to the account's implementation.

Parameter
Parameter
Example Value
type PrepareCallsParams = [{
from: `0x${string}`
chainId: `0x${string}`
calls: {
    to: `0x${string}`
    data: `0x${string}`
    value: `0x${string}`
}[];
capabilities: Record<string, any>
}]

Return value
Return value
Return value Example
type PrepareCallsReturnValue = [{
    preparedCalls: {
        type: string
        data: any
        chainId: `0x${string}`
    }
    signatureRequest: {  
        hash: `0x${string}`
    }
    context: `0x${string}`
}]

App developers are expected to Sign the signatureRequest.hash returned from wallet_prepareCalls call using the dApp key (secp256k1 or secp256r1)

dApps makes the wallet_sendPreparedCalls JSON RPC call to wallet service API. The RPC accepts the prepared response from wallet_prepareCalls request along with a signature, and returns an EIP-5792 call bundle ID.

Examples dApp

Tic Tac Toe | Demo | Video
Dollar Cost Average | Demo | Explanation | Video
Github examples repository
Reference
ERC-7715: Grant Permissions from Wallets | https://eip.tools/eip/7715
EIP-5792: Wallet Call API | https://eip.tools/eip/5792
ERC-4337 Entry Point | https://github.com/ethereum/ercs/blob/master/ERCS/erc-4337.md#entrypoint-definition
Currently supported Permission types
ContractCallPermission
export enum ParamOperator {
  EQUAL = 'EQUAL',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN'
}

export enum Operation {
  Call = 'Call',
  DelegateCall = 'DelegateCall'
}

export type ArgumentCondition = {
  operator: ParamOperator
  value: `0x${string}`
}

export type FunctionPermission = {
  functionName: string
  args?: ArgumentCondition[]
  valueLimit?: `0x${string}`
  operation?: Operation
}
export type ContractCallPermission = {
  type: 'contract-call'
  data: {
    address: `0x${string}`
    abi: Record<string, unknown>[]
    functions: FunctionPermission[]
  }
}

Relay
Project ID
The Project ID is consumed through URL parameters.

URL parameters used:

projectId: Your Project ID can be obtained from cloud.reown.com
Example URL:

https://relay.walletconnect.com/?projectId=c4f79cc821944d9680842e34466bfbd

This can be instantiated from the client with the projectId in the SignClient constructor.

import SignClient from '@walletconnect/sign-client'
const signClient = await SignClient.init({
  projectId: 'c4f79cc821944d9680842e34466bfb'
})

Allowlist
To help prevent malicious use of your project ID you are strongly encouraged to set an allowlist of origins or application/bundle ids for mobile applications where the project ID is used. Requests from other origins will be denied.

Allowlist supports a list of origins in the format [scheme://]<hostname[:port].
Application ID/Bundle IDs typically are defined using the reverse domain name notation
Using localhost (or 127.0.0.1) is always permitted, and if empty all origins are allowed. Updates take 15 minutes to apply.

If scheme or port is specified, it must match exactly. Hostname must also match exactly, but wildcards can be used for individual labels within the hostname.

Example of possible origins in the allowlist:

example.com - allows https://example.com or http://example.com but not https://www.example.com
https://example.com - allows https://example.com but not http://example.com
https://www.example.com - allows https://www.example.com but not https://example.com
https://example.com:8080 - allows https://example.com:8080 but not https://example.com
https://*.example.com - allows https://www.example.com but not https://example.com
https://*.*.example.com - allows https://www.subdomain.example.com but not https://www.example.com or https://example.com
https://www.*.example.com - allows https://www.subdomain.example.com but not https://www.example.com
https://www-*.example.com - invalid; * must be the full label
Error Codes
Reason	Error Code
Project ID doesn't exist OR JWT is expired	401
Exists and is invalid	403
Too many requests	1013
Websocket Close Codes
Code	Description	Reconnect
1001	Server terminating	Yes
4008	Client stale: connected without a prior subscription and is not sending data	When needed
4010	Load Rebalancing	Yes
Best Practices
Create a new projectId for each project. This allows for more granular control, dedicated explorer listings, and project metrics.
Don't reuse a projectId.
Use the AllowList to limit unauthorized usage.
Avoid committing projects keys to the repo. Use env variables instead.

в файле .env используй данные: VITE_APP_PROJECT_ID=9a6515f7259ebccd149fd53341e01e6b
