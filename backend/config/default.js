import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  ethereumNetwork: {
    url: process.env.ETHEREUM_NETWORK_URL,
    privateKey: process.env.PRIVATE_KEY
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  cors: {
    origin: 'http://localhost:5173', // URL фронтенда
    credentials: true
  },
  session: {
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 часа
    }
  }
};

