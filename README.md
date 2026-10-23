# HoneyChain

> **Smart India Hackathon 2026 Prototype**  
> AI & IoT-based Honeybee Monitoring and Ethereum Sepolia Blockchain Honey Traceability

HoneyChain bridges the gap between rural beekeepers and modern consumers. The system integrates IoT hive sensors for real-time bee colony health monitoring, AI microservices for predictive colony diagnostics, and the **Ethereum Sepolia** blockchain for immutable, tamper-resistant honey batch provenance and anti-adulteration verification.

---

## Repository Structure

```text
HoneyChain/
├── backend/            # Express REST API, MongoDB models, MQTT ingestion, ethers.js client
│   ├── src/            # Application source code
│   ├── docs/           # Backend-specific documentation
│   ├── .env.example    # Backend environment variable template
│   ├── package.json    # Backend dependencies and scripts
│   └── tsconfig.json   # TypeScript configuration
├── blockchain/         # Ethereum Sepolia smart contracts and Hardhat development suite
│   ├── contracts/      # Solidity smart contracts (HoneyChainRegistry.sol)
│   ├── scripts/        # Deployment and interaction scripts
│   ├── test/           # Smart contract test suites
│   ├── deployments/    # Network deployment records (addresses, ABIs, tx hashes)
│   │   └── sepolia/
│   ├── .env.example    # Blockchain environment variable template
│   └── README.md       # Blockchain subsystem overview
├── docs/               # System documentation and architecture records
│   ├── README.md       # Documentation Hub & directory index
│   ├── api.md          # Complete REST API reference (19 endpoints)
│   ├── architecture.md # End-to-end system design and data flow
│   ├── contract.md     # Smart contract reference (Sepolia)
│   ├── ml-integration.md # AI/ML inference microservice architecture
│   ├── setup.md        # Environment setup and developer instructions
│   ├── decisions.md    # Architecture Decision Records (ADRs)
│   └── changelog.md    # Phase-by-phase project changelog
├── .gitignore          # Repository-wide ignore rules
└── README.md           # Master repository overview (this document)
```

---

## Evaluation & Demo Credentials

> [!IMPORTANT]
> **Universal Demo Password:** `Password123!`  
> **Direct Login Portal:** [https://www.honeychain.in/login](https://www.honeychain.in/login)  
> *(Logging in with any account below automatically routes to that role's dedicated portal)*

| Stakeholder Role | Login Email | Key Workflow to Evaluate |
| :--- | :--- | :--- |
| **System Administrator** | `admin@honeychain.org` | Member organization approvals, system metrics & user administration |
| **Beekeeper** | `beekeeper@honeychain.org` | Live IoT hive telemetry, AI health alerts, harvests & on-chain batch creation |
| **Quality Laboratory** | `lab@honeychain.org` | Moisture assays, purity testing & Sepolia smart contract attestation |
| **Processing Plant** | `processor@honeychain.org` | Honey processing, bottling, batch packaging & custody transfer |
| **Cold-Chain Distributor** | `distributor@honeychain.org` | Cold-chain dispatch, transit temperature tracking & custody transfer |
| **Regulatory Auditor** | `auditor@honeychain.org` | Quality audits, compliance checks & emergency batch recall execution |

---

### Public Consumer Verification (No Authentication Required)

Test the public consumer verification experience without logging in:

> **Verification Portal:** [https://www.honeychain.in/verify](https://www.honeychain.in/verify)

| Sample Batch | Status | Verification Scenario | Direct Link |
| :--- | :--- | :--- | :--- |
| `HC-VERIFIED-2026` | Verified (Grade A) | Certified honey with full IoT history & Sepolia hash anchor | [Verify Batch](https://www.honeychain.in/verify/HC-VERIFIED-2026) |
| `HC-PENDING-2026` | Pending Lab | Harvested batch currently awaiting laboratory testing | [Verify Batch](https://www.honeychain.in/verify/HC-PENDING-2026) |
| `HC-RECALLED-2026` | Flagged / Recalled | Failed purity test demonstrating tamper-evident alert on scan | [Verify Batch](https://www.honeychain.in/verify/HC-RECALLED-2026) |


---

## Subsystem Responsibilities

### 1. `backend/` (Operational Core)
- **REST APIs**: Serves client requests from web portals and mobile apps.
- **MQTT Ingestion**: Receives telemetry streams from ESP32 apiary gateways.
- **Operational Database (MongoDB)**: Stores high-frequency sensor readings, hive telemetry, user authentication, apiary records, and laboratory report files.
- **AI Integration**: Connects via HTTPS to the independent Python ML microservice (`HoneyChain_ML`) for colony stress detection, disease warning, and honey yield forecasting.
- **Blockchain Client (`ethers.js`)**: Securely interfaces with Ethereum Sepolia to register batches, record custody updates, attest lab certifications, and query event logs for verification.

### 2. `blockchain/` (Immutable Provenance Ledger)
- **Network**: Ethereum Sepolia Testnet (Chain ID `11155111`, Gas token `Sepolia ETH`).
- **Role-Based Access Control**: Enforces strict authorization directly on-chain for `ADMIN`, `BEEKEEPER`, `LABORATORY`, `PROCESSOR`, `DISTRIBUTOR`, and `AUDITOR`.
- **Minimal On-Chain Footprint**: Stores only cryptographic anchors (metadata SHA-256 hashes, lab certificate hashes, custodian addresses, quality grades, batch status). Does **not** store raw telemetry or binary documents.
- **Event-Driven Auditability**: Emits indexed events (`BatchRegistered`, `BatchCertified`, `CustodyTransferred`, `BatchRecalled`) allowing instant reconstruction of a honey batch journey via Sepolia RPC.

### 3. `docs/` (System Truth & Specifications)
- Centralized, version-controlled documentation repository.
- Contains system architecture diagrams, ADRs, developer setup steps, and progress changelogs.

---

## Communication: Backend ↔ Blockchain

The Express backend connects to Ethereum Sepolia using **`ethers.js` (v6)** over standard JSON-RPC:
- **Write Operations (Transactions)**: Backend loads role-specific server-side private keys (e.g. Beekeeper wallet for batch registration, Laboratory wallet for certification), estimates gas, signs transactions, and broadcasts to Ethereum Sepolia. Transaction hashes and block confirmations are recorded in MongoDB.
- **Read Operations (Event Filtering & Verification)**: When a consumer scans a QR code, the backend queries the contract view method `getBatch()` and filters historical EVM event logs (`queryFilter`) to build the chronological lifecycle timeline directly from the blockchain.

---

## Security & Secrets Management

- **Isolated `.env` Files**: Secrets are stored in subsystem-specific `.env` files (`backend/.env` and `blockchain/.env`).
- **Strict `.gitignore`**: All `.env` files, private keys (`*.key`, `*.pem`), and build outputs (`artifacts/`, `cache/`, `dist/`) are strictly ignored by Git. Only template `.env.example` files are committed.
- **Server-Side Key Isolation**: Private keys are restricted to server-side memory, never logged, and never returned across API endpoints to frontend clients.
- **Testnet-Only Wallets**: Development uses dedicated Ethereum Sepolia testnet wallets with zero real-world monetary value.

---

## Quick Reference Links

- [Documentation Hub](docs/README.md)
- [REST API Documentation](docs/api.md) *(Mandatory: keep updated whenever endpoints change)*
- [System Architecture](docs/architecture.md)
- [Smart Contract Specifications](docs/contract.md)
- [AI / ML Integration](docs/ml-integration.md)
- [Developer Setup Guide](docs/setup.md)
- [Architecture Decisions (ADRs)](docs/decisions.md)
- [Changelog](docs/changelog.md)