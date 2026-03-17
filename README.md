# BlockFund

**Decentralized, milestone-based crowdfunding on Ethereum.**

BlockFund is a full-stack Web3 platform where campaigners raise ETH-based funding and investors maintain control through milestone voting. Funds are released incrementally — only when the community approves each milestone — ensuring transparency and accountability.

---

## ✨ Features

### For Campaigners
- Create campaigns with a funding goal, duration, and custom milestones
- Define milestone percentages (must total 100%)
- Request milestone approval and receive funds upon investor vote
- Dedicated campaigner dashboard to track campaign progress

### For Investors
- Browse and discover campaigns by category or search
- Invest ETH directly via MetaMask
- Vote on milestone completion (>50% approval required to release funds)
- Automatic refund if campaign goal isn't met by the deadline
- Portfolio view to track all investments

### Platform
- **Role-based authentication** — separate campaigner and investor accounts
- **Dark / Light theme** toggle
- **On-chain + off-chain hybrid** — metadata stored in SQL.js, funds managed by smart contracts
- **Protected routes** — role-specific access control

---

## 🛠 Tech Stack

| Layer            | Technology                                  |
|------------------|---------------------------------------------|
| **Frontend**     | React 18, Vite 5, React Router 6            |
| **Styling**      | Vanilla CSS, Inter (Google Fonts)            |
| **Blockchain**   | Solidity 0.8.19, Hardhat, Ethers.js 6       |
| **Backend**      | Express.js, JWT Authentication              |
| **Database**     | SQL.js (SQLite in-memory)                   |
| **Wallet**       | MetaMask                                    |

---

## 📁 Project Structure

```
BlockFund/
├── contracts/                # Solidity smart contracts
│   ├── BlockFundFactory.sol  # Factory to deploy campaign contracts
│   └── Campaign.sol          # Individual campaign logic (invest, vote, refund)
├── scripts/
│   └── deploy.cjs            # Hardhat deployment script
├── server/                   # Express backend
│   ├── server.js             # API entry point
│   ├── db.js                 # SQL.js database setup
│   └── routes/
│       ├── auth.js           # Registration & login endpoints
│       └── campaigns.js      # Campaign CRUD endpoints
├── src/                      # React frontend
│   ├── components/           # Navbar and shared UI
│   ├── contexts/             # AuthContext, ThemeContext
│   ├── contracts/            # ABI files & deployed addresses
│   ├── pages/                # All page components
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── CampaignerDashboard.jsx
│   │   ├── InvestorDashboard.jsx
│   │   ├── CreateCampaign.jsx
│   │   ├── Discover.jsx
│   │   ├── CampaignDetail.jsx
│   │   └── Portfolio.jsx
│   ├── utils/ethereum.js     # MetaMask & contract helpers
│   ├── App.jsx               # Routes & protected route logic
│   └── index.css             # Global styles & theme variables
├── hardhat.config.cjs
├── package.json
└── index.html
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [MetaMask](https://metamask.io/) browser extension

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Local Blockchain

```bash
npx hardhat node
```

### 3. Deploy Smart Contracts

In a new terminal:

```bash
npx hardhat run scripts/deploy.cjs --network localhost
```

This deploys the `BlockFundFactory` contract and copies ABIs + addresses to `src/contracts/`.

### 4. Configure MetaMask

- Add a custom network: **RPC URL** `http://127.0.0.1:8545`, **Chain ID** `31337`
- Import one of the Hardhat test accounts using its private key

### 5. Start the Backend Server

```bash
npm run server
```

The API runs on `http://localhost:3001`.

### 6. Start the Frontend

```bash
npm run dev
```

The app runs on `http://localhost:5173`.

---

## 📜 Smart Contract Architecture

### BlockFundFactory
- Deploys individual `Campaign` contracts
- Tracks all deployed campaign addresses

### Campaign
Each campaign contract manages:
- **Investing** — anyone can send ETH while the campaign is active
- **Milestones** — creator defines milestones; funds are released proportionally
- **Voting** — investors vote on milestone completion (majority required)
- **Refunds** — automatic refunds if the goal isn't reached by the deadline

---

## 🔐 Authentication Flow

1. Users register as either **Campaigner** or **Investor**
2. Credentials are hashed with bcrypt and stored in SQL.js
3. On login, a JWT token is issued for API authentication
4. Frontend uses `AuthContext` for role-based route protection

---

## 📡 API Endpoints

| Method | Endpoint              | Description                  |
|--------|-----------------------|------------------------------|
| POST   | `/api/auth/register`  | Register a new user          |
| POST   | `/api/auth/login`     | Login and receive JWT        |
| GET    | `/api/campaigns`      | List all campaigns           |
| POST   | `/api/campaigns`      | Create a new campaign        |
| GET    | `/api/health`         | Server health check          |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
