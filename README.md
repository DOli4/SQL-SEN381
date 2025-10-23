# CampusLearn - Educational Learning Management System

A comprehensive learning management system built with Node.js, Express, and Microsoft SQL Server, featuring an AI-powered study assistant using Google's Gemini API.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [AI Assistant Features](#ai-assistant-features)
- [Contributing](#contributing)

## Features

### Core Functionality
- **User Management**: Role-based access control (Student, Tutor, Admin)
- **Course Management**: Create and manage modules, topics, and educational content
- **Discussion Forums**: Topic-based discussions with threaded replies
- **Content Sharing**: Upload and share educational resources (PDFs, DOCX, PPTX, etc.)
- **Subscriptions**: Students can subscribe to topics and tutors
- **Messaging System**: Thread-based messaging between users
- **Profile Management**: User profile editing and management

### AI-Powered Features
- **RAG-based Study Assistant**: AI chatbot using Retrieval-Augmented Generation
- **Document Processing**: Automatic ingestion and embedding of study materials
- **Semantic Search**: Find relevant content using vector similarity
- **Context-Aware Responses**: Answers grounded in course materials

### Security
- JWT-based authentication with HTTP-only cookies
- Role-based access control (RBAC)
- Password hashing with bcrypt
- SQL injection protection via parameterized queries
- Trusted SSL/TLS connections

## Technology Stack

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: Microsoft SQL Server (Windows Authentication)
- **ORM/Driver**: mssql + msnodesqlv8
- **Authentication**: JSON Web Tokens (JWT)
- **Templating**: EJS with express-ejs-layouts

### AI/ML
- **LLM Provider**: Google Gemini API (@google/generative-ai)
- **Vector Store**: In-memory vector storage with cosine similarity
- **Document Processing**: pdf-parse, mammoth, pptx-parser

### Frontend
- **Vanilla JavaScript** with EJS templates
- **CSS**: Custom styling
- **Client-side routing**: SPA-like experience

### Development Tools
- **Testing**: Jest (with coverage reporting)
- **Dev Server**: Nodemon (auto-restart)
- **Environment**: dotenv

## Project Structure

```
SQL-SEN381/
├── Assignment2/              # Database schema and SQL scripts
│   └── database             # CampusLearn database creation script
├── CampusLearn/             # C# domain models (reference implementation)
│   ├── Program.cs
│   └── Models/              # User, Module, Topic, Content, etc.
├── data/
│   ├── kb.jsonl            # Knowledge base for AI assistant
│   └── studydocs/          # Study documents for ingestion
├── public/                  # Static assets
│   ├── app.js              # Main client application
│   ├── chatbot.css
│   ├── forum.js
│   ├── register.js
│   └── images/
├── src/
│   ├── server.js           # Main Express server
│   ├── crud.js             # CRUD interface routes
│   ├── editor.js           # Content editor routes
│   ├── diag.js             # Diagnostics routes
│   ├── controllers/        # Business logic
│   │   ├── auth.controller.js
│   │   ├── content.controller.js
│   │   ├── subscriptions.controller.js
│   │   └── topics.controller.js
│   ├── db/
│   │   └── mssql.js        # Database connection pool
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication
│   │   └── rbac.js         # Role-based access control
│   ├── routes/             # API and page routes
│   │   ├── auth.routes.js
│   │   ├── topics.routes.js
│   │   ├── students.routes.js
│   │   ├── tutors.routes.js
│   │   ├── content.routes.js
│   │   ├── geminiRoute.js  # AI assistant endpoints
│   │   └── ...
│   ├── services/
│   │   ├── assistant.js    # RAG-based AI assistant
│   │   └── providers/
│   │       └── gemini.js   # Gemini API integration
│   └── utils/
│       ├── vstore.js       # Vector store implementation
│       ├── jwt.js          # JWT utilities
│       ├── uploads.js      # File upload handling
│       ├── nlu.js          # Natural language understanding
│       └── ingestLocalFolder.js
├── tests/                   # Jest test suites
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   └── utils/
├── views/                   # EJS templates
│   ├── layout.ejs
│   ├── dashboard.ejs
│   ├── forum.ejs
│   ├── chatbot.ejs
│   ├── auth-login.ejs
│   └── ...
├── jest.config.js
└── package.json
```

## Prerequisites

- **Node.js**: v18+ (ES Modules support)
- **Microsoft SQL Server**: 2016+ (Windows Authentication)
- **ODBC Driver**: ODBC Driver 17 or 18 for SQL Server
- **Google Gemini API Key**: For AI features
- **Windows OS**: Required for Windows Authentication to SQL Server

## Installation

1. **Clone the repository**
   ```powershell
   git clone https://github.com/DOli4/SQL-SEN381.git
   cd SQL-SEN381
   ```

2. **Install dependencies**
   ```powershell
   npm install
   ```

3. **Set up the database**
   - Open SQL Server Management Studio (SSMS)
   - Connect to your SQL Server instance
   - Open and execute `Assignment2/database` script
   - This will create the `CampusLearn` database with all required tables

4. **Configure environment variables**
   - Copy `.env.example` to `.env` (or create a new `.env` file)
   - Update the configuration (see [Configuration](#configuration))

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# SQL Server Configuration
SQL_SERVER=ULI                    # Your SQL Server name
SQL_INSTANCE=                      # Instance name (if applicable)
SQL_DB=CampusLearn
# Driver: ODBC Driver 17 or 18 for SQL Server

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key-here

# Client Configuration (for CORS)
CLIENT_ORIGIN=http://localhost:3000

# File Upload Configuration
MAX_FILE_SIZE=10485760            # 10MB in bytes
UPLOAD_PATH=./uploads
```

### Database Connection Notes

The application uses **Windows Authentication** to connect to SQL Server. Make sure:
- Your Windows user has access to the SQL Server instance
- The `CampusLearn` database exists
- The appropriate ODBC driver is installed (17 or 18)

To check your ODBC driver version:
```powershell
odbcad32
```

## Running the Application

### Development Mode (with auto-restart)
```powershell
npm run dev
```

### Production Mode
```powershell
npm start
```

### Access the Application
- **Main Application**: http://localhost:3000
- **Health Check**: http://localhost:3000/_ping
- **Database Test**: http://localhost:3000/db-test

### First Time Setup
1. Register a new account at http://localhost:3000/register
2. Use an email ending with `@belgiumcampus.ac.za` (enforced by database constraint)
3. Login at http://localhost:3000/login
4. Access the dashboard to start using the system

## Testing

### Run all tests
```powershell
npm test
```

### Run tests with coverage
```powershell
npm run test:cov
```

### Test Structure
- **Unit Tests**: Controllers, utilities, middleware
- **Integration Tests**: Routes and API endpoints
- **UI Tests**: View rendering tests (using jsdom)

Coverage reports are generated in the `coverage/` directory.

## 📡 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user
```json
{
  "username": "john_doe",
  "email": "john@belgiumcampus.ac.za",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "Student"
}
```

#### POST `/api/auth/login`
Login and receive JWT token
```json
{
  "email": "john@belgiumcampus.ac.za",
  "password": "SecurePass123"
}
```

#### POST `/api/auth/logout`
Logout (clears JWT cookie)

### Topics Endpoints

#### GET `/api/topics`
Get all topics (authenticated)

#### GET `/api/topics/:id`
Get a specific topic with replies

#### POST `/api/topics`
Create a new topic
```json
{
  "moduleId": 1,
  "title": "How to use async/await in JavaScript?",
  "body": "I'm confused about async programming..."
}
```

#### PUT `/api/topics/:id`
Update an existing topic

#### DELETE `/api/topics/:id`
Delete a topic (soft delete)

### Content Endpoints

#### POST `/api/content/upload`
Upload educational content (multipart/form-data)
- Supports: PDF, DOCX, PPTX, TXT, MD
- Automatically ingested into AI knowledge base

#### GET `/api/topics/:id/content`
Get all content for a topic

#### GET `/api/content/:contentId/inline`
View content inline (for preview)

### AI Assistant Endpoints

#### POST `/api/gemini/chat`
Ask the AI study assistant
```json
{
  "question": "What is polymorphism in OOP?"
}
```

#### POST `/api/gemini/ingest-all`
Ingest all documents from `data/studydocs/`

#### GET `/api/gemini/status`
Check AI assistant status and document count

### Subscription Endpoints

#### GET `/api/users/:userId/subscriptions`
Get user's topic subscriptions

#### GET `/api/topics/:topicId/subscribers`
Get topic subscribers

#### POST `/api/subscriptions`
Subscribe to a topic

#### DELETE `/api/subscriptions/:id`
Unsubscribe from a topic

## Database Schema

### Core Tables

#### Roles
- `Role_ID` (PK)
- `Name` (Student, Tutor, Admin)
- `Description`

#### User
- `User_ID` (PK)
- `Role_ID` (FK → Roles)
- `Username` (unique)
- `Email` (unique, must end with @belgiumcampus.ac.za)
- `Password` (bcrypt hashed)
- `First_Name`, `Last_Name`, `Phone`
- `Credentials`, `DOB`, `Status`
- `Created_On`

#### Modules
- `Module_ID` (PK)
- `Module_Code` (unique)
- `Module_Name`
- `Description`

#### Topic
- `Topic_ID` (PK)
- `Module_ID` (FK → Modules)
- `User_ID` (FK → User, creator)
- `Title`, `Body`
- `Created_On`, `Updated_On`
- `Is_Deleted` (soft delete)

#### Reply
- `Reply_ID` (PK)
- `Topic_ID` (FK → Topic)
- `User_ID` (FK → User)
- `Parent_Reply_ID` (FK → Reply, for threading)
- `Reply_Text`
- `Created_On`, `Updated_On`

#### Content
- `Content_ID` (PK)
- `Topic_ID` (FK → Topic)
- `User_ID` (FK → User, uploader)
- `File_Path`, `File_Name`, `File_Type`
- `File_Size`
- `Uploaded_On`

#### UserModule (Enrollment)
- `UserModule_ID` (PK)
- `User_ID` (FK → User)
- `Module_ID` (FK → Modules)
- `Enrolled_On`

#### TopicSubscriber
- `Subscription_ID` (PK)
- `User_ID` (FK → User)
- `Topic_ID` (FK → Topic)
- `Subscribed_On`

#### TutorSubscriber (Mentorship)
- `TutorSubscription_ID` (PK)
- `Student_ID` (FK → User)
- `Tutor_ID` (FK → User)
- `Started_On`

## AI Assistant Features

### Retrieval-Augmented Generation (RAG)

The AI assistant uses a RAG architecture:

1. **Document Ingestion**: 
   - Upload documents via UI or place in `data/studydocs/`
   - Supports PDF, DOCX, PPTX, TXT, MD
   - Documents are chunked and embedded using Gemini embeddings

2. **Vector Storage**:
   - In-memory vector store with cosine similarity search
   - Automatically persists to `data/kb.jsonl`
   - Top-k retrieval for relevant context

3. **Response Generation**:
   - User question is embedded
   - Top 6 most relevant chunks retrieved
   - Context + question sent to Gemini
   - Response includes sources and chunk IDs

### Using the Chatbot

1. Navigate to the chatbot page
2. Type your question about course materials
3. The assistant will:
   - Search through uploaded study materials
   - Find relevant context
   - Generate an answer grounded in the materials
   - Cite sources with chunk IDs

### Document Processing

Supported formats:
- **PDF**: Extracted using pdf-parse
- **DOCX**: Extracted using mammoth
- **PPTX**: Extracted using pptx-parser
- **TXT/MD**: Direct text parsing

## User Roles

### Student
- Enroll in modules
- Create topics and post replies
- Subscribe to topics and tutors
- Upload and view content
- Use AI study assistant

### Tutor
- All student permissions
- Mentor students
- Mark replies as solutions
- Moderate discussions

### Admin
- All tutor permissions
- Manage users and roles
- View system diagnostics
- Access CRUD interface
- Manage modules

##  Security Best Practices

1. **Never commit `.env` files** - Contains sensitive credentials
2. **Use strong JWT secrets** - Generate with `crypto.randomBytes(64).toString('hex')`
3. **HTTPS in production** - Always use SSL/TLS
4. **Regular dependency updates** - Run `npm audit` regularly
5. **Input validation** - Express-validator on all inputs
6. **SQL parameterization** - All queries use prepared statements
7. **Rate limiting** - Consider adding rate limiting middleware for production

## Development Notes

### ES Modules
This project uses ES Modules (`"type": "module"` in package.json). Use:
- `import` instead of `require`
- `.js` extensions in imports
- `__dirname` is not available (use `process.cwd()` or `path.resolve()`)

### Windows-Specific Setup
The project uses Windows Authentication for SQL Server:
- Requires `msnodesqlv8` driver
- Must run on Windows
- SQL Server connection uses `Trusted_Connection=Yes`

### Code Style
- Use ES6+ features
- Follow existing code formatting
- Add JSDoc comments for functions
- Write tests for new features

## License

This project is part of the SEN 381 course at Belgium Campus ITversity.
---

**Repository**: [SQL-SEN381](https://github.com/DOli4/SQL-SEN381)  
**Current Branch**: Uli_Branch  
**Last Updated**: October 2025
