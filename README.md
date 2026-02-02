<p align="center">
  <a href="https://baztille.org" target="blank"><img src="https://baztille.org/wp-content/uploads/2025/11/fond_jaune_large_miniature-300x208.png" width="300" alt="Baztille Logo" /></a>
</p>

# 🗳️ Baztille Backend

Baztille is a democratic decision-making platform that enables citizens to participate in collective decisions for their territories through a structured, transparent and auditable voting process.

This backend is intented to be used by Baztille Application (Android/iOS / build using React Native).

## 🌟 Overview

Baztille is a digital democracy platform that facilitates collaborative decision-making at territorial levels. The platform guides communities through a structured process of:

1. **Subject Selection** - Citizens propose and select topics that matter to their community
2. **Proposition Gathering** - Multiple solutions are submitted and refined through debate
3. **Democratic Vote** - Citizens vote on the best proposition using a secure voting system

More on https://baztille.org

## 🏗️ Architecture

Built with **NestJS** and **TypeScript**, Baztille follows a modular architecture:

- **Authentication & Authorization** - JWT-based auth with role-based access control (RBAC)
- **Territory Management** - Hierarchical territory system with organizational roles
- **Voting System** - Secure, auditable voting sessions with ballot management
- **Event Tracking** - Comprehensive analytics and user behavior tracking
- **Real-time Communication** - Chat system for debates and discussions
- **Mission System** - Gamification through user missions and leaderboard

## 🚀 Key Features

### Democratic Process

- **Multi-stage voting** with configurable timelines
- **Territory-based decisions** affecting specific geographic areas
- **Auditable voting data** designed for transparency and external review
- **Vote modification** support

### User Management

- **Role-based permissions** (Admin, Moderator, Member, Visitor)
- **Email verification** and secure authentication
- **User territories** based on polling stations
- **Mentor/recruit** referral system

### Content & Engagement

- **Debate system** with threaded discussions
- **Mission system** for user engagement
- **Leaderboard** with territory-based rankings
- **Featured decisions** for highlighting important votes
- **Hotness scoring** based on voting activity

### Analytics & Monitoring

- **Event tracking** for user actions and system events
- **Daily metrics** computation
- **Sentry integration** for error monitoring
- **Admin reports** via email

## 📦 Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT + Passport
- **Real-time**: Socket.IO
- **Scheduling**: @nestjs/schedule (Cron jobs)
- **Email**: SendGrid integration
- **SMS**: Twilio integration
- **Monitoring**: Sentry
- **Storage**: File uploads with Multer
- **Internationalization**: i18n support (FR/EN)
- **Documentation**: Swagger/OpenAPI

## 🛠️ Installation

### Prerequisites

- Node.js >= 18.x
- MongoDB >= 5.x
- npm or yarn

### Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
MONGO_DB_URI=mongodb://localhost:27017/baztille

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION_TIME=7d

# Server
PORT=4000
ENVIRONMENT=development

# External Services
SENTRY_DSN=your-sentry-dsn
SENDGRID_API_KEY=your-sendgrid-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

# Features
MODE_VOTE_DURATION=production
TIMEZONE_FOR_CRONJOBS=Europe/Paris
```

4. **Run database migrations**

```bash
npm run migration:run
```

5. **Start the server**

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## 📂 Project Structure

```
src/
├── app.module.ts                 # Root application module
├── main.ts                       # Application entry point
├── common/                       # Shared utilities
│   ├── database/                 # Database configuration
│   ├── email/                    # Email service
│   ├── filter/                   # Exception filters
│   ├── guards/                   # Auth guards
│   ├── interceptor/              # Request/response interceptors
│   ├── metrics/                  # Metrics computation
│   └── pipes/                    # Validation pipes
├── cronJob/                      # Scheduled tasks
│   ├── Cron.provider.ts          # Cron job definitions
│   └── Cron.module.ts            # Cron module
├── enum/                         # Enumerations
├── interface/                    # TypeScript interfaces
│   └── event-types.ts            # Event tracking types
├── resources/                    # Business logic modules
│   ├── authentication/           # Auth & country data
│   ├── countrymodel/             # Territory management
│   ├── debate/                   # Debate system
│   ├── event/                    # Event tracking
│   ├── profile/                  # User profiles
│   │   ├── user/                 # User management
│   │   ├── leaderboard/          # Rankings
│   │   └── mission/              # User missions
│   ├── support/                  # Support tickets
│   ├── translate/                # Translation service
│   └── vote/                     # Voting system
│       ├── decision/             # Decision lifecycle
│       ├── voting-session/       # Vote sessions
│       └── test-vote/            # Vote testing
├── schema/                       # Database schemas
└── utils/                        # Utility functions
    ├── logger.ts                 # Logging utility
    └── dateTime.ts               # Date helpers
```

## 📊 API Documentation

Once the server is running, access the Swagger documentation at:

```
http://localhost:4000/api
```

## 🔐 Security

- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting on sensitive endpoints
- Helmet for security headers
- Input validation with class-validator
- SQL injection prevention via Mongoose
- Secure password hashing with bcrypt

## 📝 Event Tracking

Baztille includes comprehensive event tracking for:

- **Authentication events**: login, registration, logout
- **User actions**: profile updates, role changes
- **Voting events**: ballot requests, votes, results viewing
- **Chat events**: messages, room creation
- **Mission events**: completion, rewards
- **Navigation**: screen views, clicks
- **Errors**: API errors, system failures

Events can be sent from:

- External clients (mobile apps, web) via REST API
- Internal backend operations via EventTrackerService

## 🌍 Internationalization

Supported languages:

- French (fr) - Default
- English (en)

Translation files located in `i18n/` directory.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.

See the [LICENSE](./LICENSE) file for details.

## 🐛 Bug Reports

For bug reports and feature requests, please use the issue tracker.

## 📞 Support

For support, email contact@baztille.com or join our community chat.

---

**Baztille** - Democracy in action 🗳️
