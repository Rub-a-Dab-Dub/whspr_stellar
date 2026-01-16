# Whisper Built on Stellar

**A gamified, on-chain messaging app where gossip meets blockchain**

Chat, tip friends, join exclusive rooms, and level up—all with near-zero gas fees on BNB, Celo, and Base.

 **Live App**: [www.gaslessgossip.com](https://www.gaslessgossip.com)  
 **Docs**: [Coming Soon]  
 **Discord**: [Join Community]



##  What Can You Do?

-  **Chat & Earn**: Send messages and earn XP
-  **Tip in Chats**: Reward users with tokens (2% platform fee)
-  **Token-Gated Rooms**: Create paid or invite-only rooms
- **P2P Transfers**: Send tokens to friends (no fees!)
- **Level Up**: Complete quests, earn badges, climb leaderboards
- **Timed Rooms**: Ephemeral chats that auto-delete

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop ([Download](https://www.docker.com/products/docker-desktop/)) **OR** PostgreSQL 14+
- Flutter 3.x (for mobile, optional)
- EVM-compatible wallet (MetaMask, Celo Wallet, etc.)

### Option A: Docker Setup (Recommended) 🐳

**Fastest way to get started!** Docker handles PostgreSQL and Redis automatically.

```bash
# 1. Clone & navigate
git clone https://github.com/Rub-a-Dab-Dub/gasless_gossip.git
cd gasless_gossip

# 2. Install dependencies and setup environment files
npm run setup

# 3. Update environment variables
# Edit api/.env with your chain credentials
# - EVM_RPC_URL
# - EVM_ACCOUNT_ADDRESS
# - EVM_PRIVATE_KEY
# - EVM_CONTRACT_ADDRESS
# - JWT_SECRET (generate a secure random string)

# 4. Start Docker services (PostgreSQL + Redis)
npm run docker:start

# 5. Start development servers (API + Web)
npm run dev
```

**Done!**
- API runs on `http://localhost:3001`
- Web runs on `http://localhost:3000`
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

**See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for detailed Docker documentation.**

---

### Option B: Manual Setup

If you prefer installing PostgreSQL manually:

#### 1️ Clone & Install

```bash
git clone https://github.com/Rub-a-Dab-Dub/gasless_gossip.git
cd gasless_gossip
```

### 2️ Setup Database

```bash
# Install PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# Create database
psql -U postgres << EOF
CREATE DATABASE gasless;
CREATE USER gasless_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE gasless TO gasless_user;
\q
EOF
```

### 3️ Backend Setup (NestJS)

```bash
cd api
npm install

# Create .env file
cat > .env << EOF
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=gasless_user
DATABASE_PASS=your_secure_password
DATABASE_NAME=gasless

# EVM Chain (BNB, Celo, Base)
EVM_RPC_URL=https://rpc-url-for-your-chain
EVM_ACCOUNT_ADDRESS=your_account_address
EVM_PRIVATE_KEY=your_private_key
EVM_CONTRACT_ADDRESS=your_deployed_contract
EVM_NETWORK=base # or bnb, celo

# Auth
JWT_SECRET=your_jwt_secret_minimum_32_chars
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development
EOF

# Start backend
npm run start:dev
```

Backend runs on `http://localhost:3001`

### 4️ Web Frontend Setup (Next.js)

```bash
cd ../web
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_EVM_NETWORK=base # or bnb, celo
EOF

# Start web app
npm run dev
```

Web app runs on `http://localhost:3000`

### 5️⃣ Mobile App Setup (Flutter)

```bash
cd ../mobile
flutter pub get

# Install Stacked CLI
dart pub global activate stacked_cli

# Run on iOS/Android
flutter run
```

---

## � NPM Scripts Reference

### One-Command Development

```bash
npm run dev              # Start both API and Web (concurrent)
npm run docker:start     # Start PostgreSQL & Redis containers
```

### Docker Management

```bash
npm run docker:start     # Start Docker services
npm run docker:stop      # Stop Docker services (keeps data)
npm run docker:restart   # Restart Docker services
npm run docker:logs      # View live container logs
npm run docker:clean     # Stop and remove all data (fresh start)
```

### Development (Individual)

```bash
npm run dev:api          # Start only API server
npm run dev:web          # Start only Web server
```

### Building

```bash
npm run build            # Build both API and Web
npm run build:api        # Build only API
npm run build:web        # Build only Web
```

### Testing

```bash
npm run test             # Run all tests
npm run test:api         # Run API tests
npm run test:web         # Run Web tests
npm run test:e2e         # Run E2E tests
```

### Linting

```bash
npm run lint             # Lint all code
npm run lint:api         # Lint API only
npm run lint:web         # Lint Web only
```

### Utilities

```bash
npm run setup            # Setup environment files
npm run db:clear         # Clear database (destructive!)
npm run clean            # Remove node_modules and builds
npm run fresh            # Clean + reinstall everything
```

---

## �🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Next.js  │  │ Flutter  │  │ Telegram │     │
│  │   Web    │  │  Mobile  │  │   Bot    │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
└───────┼─────────────┼─────────────┼────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
┌─────────────────────▼─────────────────────────┐
│             NestJS Backend (3001)              │
│  • REST API  • WebSockets  • Bull Queues      │
│  • PostgreSQL  • JWT Auth  • IPFS/Arweave     │
└─────────────────────┬─────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────┐
│        EVM Chains: BNB, Celo, Base             │
│  • GGPay Contract (payments)                   │
│  • Account Abstraction (gasless)               │
│  • Session Keys (auto-approve)                 │
└───────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
gasless_gossip/
├── api/                    # NestJS backend
│   ├── src/
│   │   ├── auth/          # JWT authentication
│   │   ├── users/         # User management
│   │   ├── rooms/         # Room logic
│   │   ├── contracts/     # EVM integration
│   │   └── wallets/       # Wallet creation queue
│   └── package.json
│
├── web/                    # Next.js web app
│   ├── app/               # App router pages
│   ├── components/        # React components
│   └── lib/               # Utilities
│
├── mobile/                 # Flutter mobile app
│   ├── lib/
│   │   ├── ui/            # Stacked views
│   │   ├── services/      # Business logic
│   │   └── models/        # Data models
│   └── pubspec.yaml
│
└── contract/              # Smart contracts
    ├── evm/               # Solidity contracts for BNB, Celo, Base
    │   ├── GGPay.sol
    │   └── tests/
```

---

## 🧪 Running Tests

### Backend Tests

```bash
cd api
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run test:cov          # Coverage
```

### Contract Tests (EVM)

```bash
cd contract/evm
npx hardhat test          # Run all tests
npx hardhat test test_tip_user.js  # Run specific test
```

### Frontend Tests

```bash
cd web
npm run test              # Jest tests
npm run test:e2e          # Playwright E2E
```

---

##  Contributing

We welcome contributions! Here's how to get started:

### 1. Fork & Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/gasless_gossip.git
cd gasless_gossip
git remote add upstream https://github.com/Rub-a-Dab-Dub/gasless_gossip.git
```

### 2. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
# Examples:
# - feature/add-room-reactions
# - fix/tip-calculation-bug
# - docs/improve-setup-guide
```

### 3. Make Changes

- Follow existing code style (ESLint/Prettier for TS, Solidity formatting for contracts)
- Write tests for new features
- Update documentation if needed

### 4. Test Your Changes

```bash
# Backend
cd api && npm run test && npm run lint

# Web
cd web && npm run build && npm run lint

# Contracts
cd contract/evm && npx hardhat test
```

### 5. Commit & Push

```bash
git add .
git commit -m "feat: add room reaction feature"
# Commit message format: type(scope): description
# Types: feat, fix, docs, style, refactor, test, chore

git push origin feature/your-feature-name
```

### 6. Create Pull Request

- Go to GitHub and open a PR from your fork
- Fill in the PR template (describe changes, link issues)
- Wait for review from maintainers

### Development Guidelines

- **Code Style**: Run `npm run lint` before committing
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/)
- **Testing**: Aim for 80%+ coverage on new code
- **Documentation**: Update README/docs for user-facing changes

### Good First Issues

Look for issues tagged `good-first-issue` or `help-wanted`:
- [Backend Issues](https://github.com/Rub-a-Dab-Dub/gasless_gossip/labels/backend)
- [Frontend Issues](https://github.com/Rub-a-Dab-Dub/gasless_gossip/labels/frontend)
- [Contract Issues](https://github.com/Rub-a-Dab-Dub/gasless_gossip/labels/contracts)

---

## Key Concepts

### Account Abstraction
Users never pay gas fees. The backend's paymaster account sponsors all transactions using session keys.

### Token Tipping
Send tokens in chats with a 2% platform fee. Tips are instant and on-chain.

### Room Entry Fees
Creators can set token-gated rooms. Platform takes 2%, creator gets 98%.

### XP & Levels
- Send message: +10 XP
- Create room: +50 XP
- Tip user: +20 XP
- Level up every 1000 XP

---

## Tech Stack Details

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Web** | Next.js 14, TypeScript, TailwindCSS | Responsive web interface |
| **Frontend Mobile** | Flutter 3.x, web3dart | iOS/Android apps |
| **Backend** | NestJS, TypeORM, Bull | REST API, WebSockets, queues |
| **Database** | PostgreSQL 14+ | User data, messages, rooms |
| **Blockchain** | BNB, Celo, Base (Solidity) | Payment contracts |
| **Storage** | IPFS/Arweave | Media files (hashed on-chain) |
| **Auth** | JWT, session keys | Gasless transactions |

---

##  Environment Variables

### Backend (api/.env)

```env
# Required
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=gasless_user
DATABASE_PASS=your_password
DATABASE_NAME=gasless

EVM_RPC_URL=https://rpc-url-for-your-chain
EVM_ACCOUNT_ADDRESS=0x...
EVM_PRIVATE_KEY=0x...
EVM_CONTRACT_ADDRESS=0x...

JWT_SECRET=minimum_32_character_secret

# Optional
PORT=3001
NODE_ENV=development
MAX_RETRIES=3
RETRY_DELAY_MS=2000
```

### Web (web/.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_EVM_NETWORK=base # or bnb, celo
```

---

##  Troubleshooting

### Docker Issues

**Port 5432 already in use:**
```bash
# Stop local PostgreSQL
brew services stop postgresql@14  # macOS
sudo systemctl stop postgresql    # Linux
```

**Containers won't start:**
```bash
npm run docker:logs      # Check logs
npm run docker:clean     # Reset everything
npm run docker:start     # Start fresh
```

**Database connection refused:**
```bash
# Wait for PostgreSQL to be ready
npm run docker:logs      # Look for "database system is ready"
```

### Backend Issues

### Backend won't start
- Check PostgreSQL is running: `brew services list`
- Verify database exists: `psql -U postgres -l`
- Check `.env` file has all required variables

### EVM transactions fail
- Check contract address is correct
- Verify RPC URL is responsive

### Mobile app build fails
- Run `flutter doctor` to check dependencies
- Clear build cache: `flutter clean && flutter pub get`
- For iOS: `cd ios && pod install`

### Web app 404 errors
- Check backend is running on port 3001
- Verify `NEXT_PUBLIC_API_URL` matches backend URL

---

##  License

MIT License - see [LICENSE](LICENSE) file for details

---

##  Acknowledgments

- Stellar for blockchain infrastructure
- OpenZeppelin for secure contract libraries
- NestJS team for excellent backend framework

---

##  Contact & Community

- **Website**: [www.gaslessgossip.com](https://www.gaslessgossip.com)
- **GitHub**: [Rub-a-Dab-Dub/gasless_gossip](https://github.com/Rub-a-Dab-Dub/gasless_gossip)
- **Twitter**: [@gaslessgossip](https://twitter.com/gaslessgossip)
- **Telegram**: [Join Group](https://t.me/gaslessgossip)
- **Discord**: [Join Server](https://discord.gg/gaslessgossip)

---

**Built with ❤️ by the whspr team**
