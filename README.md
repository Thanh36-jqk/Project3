# Apple Store E-commerce Website

A full-stack e-commerce platform specializing in Apple products with AI-powered customer support, 3D product visualization, and comprehensive admin management.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Features

### User Features

- User authentication with email/password and Google OAuth 2.0
- Product browsing across categories: iPhone, iPad, Mac, Apple Watch
- Real-time product search with instant results
- Shopping cart management with persistent storage
- Wishlist functionality for saved items
- Multi-tier loyalty program with rank-based rewards (Silver, Gold, VIP)
- Voucher system with automatic discount application
- Multiple payment method support during checkout
- Order tracking and history management
- 3D product viewer powered by Three.js
- AI-powered chatbot for 24/7 customer support

### Admin Features

- Centralized dashboard for system overview
- Product management: create, update, delete operations
- Order management with status tracking
- User management and role assignment
- Voucher creation and management
- Sales analytics and reporting

### Technical Features

- RESTful API architecture
- JWT-based authentication with refresh tokens
- MongoDB with Mongoose ODM for data persistence
- Google Gemini 2.5 Flash integration for intelligent chatbot
- Responsive design for mobile and desktop
- Optimized for Vercel deployment

## Tech Stack

| Category | Technology |
|----------|-----------|
| Backend | Node.js, Express.js 5 |
| Database | MongoDB, Mongoose ODM |
| Authentication | JWT, bcrypt, Passport.js (Google OAuth 2.0) |
| AI | Google Gemini 2.5 Flash |
| Frontend | HTML5, CSS3, Vanilla JavaScript, Three.js |
| Deployment | Vercel |

## Prerequisites

Before running this application, ensure you have the following installed:

- Node.js (version 14.x or higher)
- npm or yarn package manager
- MongoDB (local installation or MongoDB Atlas account)
- Google Cloud Console account (for OAuth credentials)
- Google AI Studio account (for Gemini API key)

## Installation

1. Clone the repository

```bash
git clone <repository-url>
cd Project3
```

2. Install dependencies

```bash
npm install
```

3. Create environment file

```bash
cp .env.example .env
```

Then edit `.env` and fill in your actual values for database, API keys, etc.

4. Configure environment variables (see [Environment Variables](#environment-variables))

5. Run the application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

**Backend only:**
```bash
npm run server
```

The application will be available at `http://localhost:3000` (or your configured PORT).

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URL` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT token generation | Yes |
| `GEMINI_API_KEY` | Google Gemini API key for chatbot | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | Yes |
| `PORT` | Server port number (default: 3000) | No |

## API Documentation

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | User login | No |
| GET | `/api/auth/google` | Initiate Google OAuth | No |
| GET | `/api/auth/google/callback` | Google OAuth callback | No |
| POST | `/api/auth/refresh` | Refresh access token | No |
| POST | `/api/auth/logout` | User logout | Yes |

### Products

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/products` | Get all products | No |
| GET | `/api/products/:id` | Get product by ID | No |
| GET | `/api/products/category/:category` | Get products by category | No |
| GET | `/api/products/search` | Search products | No |
| POST | `/api/products` | Create product | Yes (Admin) |
| PUT | `/api/products/:id` | Update product | Yes (Admin) |
| DELETE | `/api/products/:id` | Delete product | Yes (Admin) |

### Cart

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/cart` | Get user cart | Yes |
| POST | `/api/cart/add` | Add item to cart | Yes |
| PUT | `/api/cart/update/:itemId` | Update cart item quantity | Yes |
| DELETE | `/api/cart/remove/:itemId` | Remove item from cart | Yes |
| DELETE | `/api/cart/clear` | Clear entire cart | Yes |

### Wishlist

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/wishlist` | Get user wishlist | Yes |
| POST | `/api/wishlist/add` | Add product to wishlist | Yes |
| DELETE | `/api/wishlist/remove/:productId` | Remove from wishlist | Yes |

### Orders

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/orders/create` | Create new order | Yes |
| GET | `/api/orders` | Get user orders | Yes |
| GET | `/api/orders/:id` | Get order details | Yes |
| PUT | `/api/orders/:id/status` | Update order status | Yes (Admin) |
| GET | `/api/orders/admin/all` | Get all orders | Yes (Admin) |

### Vouchers

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/vouchers` | Get available vouchers | Yes |
| POST | `/api/vouchers/apply` | Apply voucher code | Yes |
| POST | `/api/vouchers/create` | Create voucher | Yes (Admin) |
| PUT | `/api/vouchers/:id` | Update voucher | Yes (Admin) |
| DELETE | `/api/vouchers/:id` | Delete voucher | Yes (Admin) |

### Admin

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/dashboard` | Get dashboard statistics | Yes (Admin) |
| GET | `/api/admin/users` | Get all users | Yes (Admin) |
| PUT | `/api/admin/users/:id/rank` | Update user rank | Yes (Admin) |

### Chatbot

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/chatbot/message` | Send message to AI chatbot | No |

## Project Structure

```
Project3/
├── src/                      # Backend source code
│   ├── config/              # Configuration files
│   │   ├── database.js      # MongoDB connection
│   │   ├── passport.js      # Passport strategies
│   │   └── gemini.js        # Gemini AI setup
│   ├── models/              # Mongoose schemas
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Cart.js
│   │   ├── Order.js
│   │   └── Voucher.js
│   ├── controllers/         # Business logic
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── cartController.js
│   │   ├── orderController.js
│   │   ├── voucherController.js
│   │   ├── wishlistController.js
│   │   ├── chatbotController.js
│   │   └── adminController.js
│   ├── routes/              # API routes
│   │   ├── index.js         # Main router
│   │   ├── authRoutes.js
│   │   ├── productRoutes.js
│   │   ├── cartRoutes.js
│   │   ├── orderRoutes.js
│   │   ├── voucherRoutes.js
│   │   ├── wishlistRoutes.js
│   │   ├── chatbotRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/          # Express middleware
│   │   ├── auth.js          # Authentication
│   │   └── errorHandler.js  # Error handling
│   └── utils/               # Helper functions
├── public/                  # Frontend static files
│   ├── index.html           # Landing page
│   ├── store.html           # Product catalog
│   ├── checkout.html        # Checkout page
│   ├── support.html         # Support page
│   ├── ACCOUNT.html         # Account page
│   ├── watch.html           # Apple Watch page
│   ├── css/                 # Stylesheets
│   │   ├── checkout.css
│   │   ├── pages/           # Page-specific styles
│   │   └── components/      # Component styles
│   ├── js/                  # JavaScript
│   │   ├── 3d-viewer.js     # Three.js viewer
│   │   ├── products/        # Product scripts
│   │   └── utils/           # Utility functions
│   ├── pages/               # Sub-pages
│   │   ├── auth/            # Login, Register
│   │   ├── products/        # Mac, iPad, iPhone
│   │   ├── account/         # Account management
│   │   └── admin/           # Admin dashboard
│   └── assets/              # Static assets
│       ├── images/          # Product images
│       ├── models/          # 3D models
│       └── 3d/              # Three.js assets
├── scripts/                 # Utility scripts
│   ├── seed.js              # Database seeding
│   ├── importProducts.js    # Product import
│   ├── verify-models.js     # Model verification
│   └── test-ai.js           # AI testing
├── docs/                    # Documentation
│   ├── diagram/             # Architecture diagrams
│   └── references.bib       # References
├── tests/                   # Test files (future)
├── server.js                # Main entry point
├── package.json             # Dependencies
├── vercel.json              # Vercel configuration
├── .env.example             # Environment template
├── .gitignore               # Git ignore rules
└── README.md                # Documentation
```

## Usage

### For Users

1. **Register/Login**: Create an account using email or Google OAuth
2. **Browse Products**: Navigate through categories or use search
3. **View Products**: Click on products to see details and 3D models
4. **Shopping Cart**: Add items to cart and proceed to checkout
5. **Wishlist**: Save favorite products for later
6. **Checkout**: Select payment method and apply vouchers
7. **Track Orders**: Monitor order status in your account
8. **AI Support**: Use the chatbot for product inquiries and support

### For Administrators

1. **Access Admin Panel**: Login with admin credentials and navigate to `/admin`
2. **Manage Products**: Add, edit, or remove products from the catalog
3. **Process Orders**: View and update order statuses
4. **Manage Users**: View user list and adjust loyalty ranks
5. **Create Vouchers**: Generate discount codes with custom parameters
6. **View Analytics**: Monitor sales and user engagement metrics

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit changes: `git commit -m 'Add some feature'`
4. Push to branch: `git push origin feature/your-feature-name`
5. Submit a pull request

Ensure your code follows the existing style conventions and includes appropriate documentation.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
