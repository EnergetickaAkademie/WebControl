import express from 'express';
import cors from 'cors';
import supertokens from 'supertokens-node';
import { middleware, errorHandler, SessionRequest } from 'supertokens-node/framework/express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';

const app = express();
const port = process.env.PORT || 3001;

// Initialize SuperTokens
supertokens.init({
    framework: 'express',
    supertokens: {
        connectionURI: process.env.SUPERTOKENS_CORE_URI || 'http://localhost:3567'
    },
    appInfo: {
        appName: 'Lecturer Login App',
        apiDomain: process.env.API_DOMAIN || 'http://localhost',
        websiteDomain: process.env.WEBSITE_DOMAIN || 'http://localhost',
        apiBasePath: '/api',
        websiteBasePath: '/'
    },
    recipeList: [
        EmailPassword.init({
            override: {
                apis: (originalImplementation) => {
                    return {
                        ...originalImplementation,
                        signUpPOST: undefined // disable sign up
                    };
                }
            }
        }),
        Session.init({
            cookieSecure: false,
            cookieSameSite: 'lax'
        })
    ]
});

// CORS configuration
app.use(cors({
    origin: 'http://localhost:4200',
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Serve static files for testing
app.use(express.static('.'));

// SuperTokens middleware
app.use(middleware());

// Protected route example
app.get('/api/dashboard', verifySession(), (req: SessionRequest, res) => {
    const userId = req.session!.getUserId();
    res.json({
        message: 'Welcome to the dashboard!',
        userId: userId
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler());

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
    console.log('SuperTokens initialized successfully');
});