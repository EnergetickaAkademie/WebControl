const supertokens = require('supertokens-node');
const EmailPassword = require('supertokens-node/recipe/emailpassword');
const Session = require('supertokens-node/recipe/session');

// Initialize SuperTokens with the same configuration as the main app
supertokens.init({
    framework: 'express',
    supertokens: {
        connectionURI: process.env.SUPERTOKENS_CORE_URI || 'http://localhost:3567',
        apiKey: undefined
    },
    appInfo: {
        appName: 'Lecturer Login App',
        apiDomain: 'http://localhost:3001',
        websiteDomain: 'http://localhost:4200',
        apiBasePath: '/api',
        websiteBasePath: '/'
    },
    recipeList: [
        EmailPassword.init(),
        Session.init()
    ]
});

// Predefined lecturer accounts
const lecturers = [
    {
        email: 'john.smith@university.edu',
        password: 'SecurePassword123!',
        name: 'Dr. John Smith'
    },
    {
        email: 'maria.garcia@university.edu',
        password: 'SecurePassword456!',
        name: 'Prof. Maria Garcia'
    },
    {
        email: 'david.johnson@university.edu',
        password: 'SecurePassword789!',
        name: 'Dr. David Johnson'
    },
    {
        email: 'admin@university.edu',
        password: 'AdminPassword123!',
        name: 'System Administrator'
    }
];

async function setupUsers() {
    console.log('Setting up predefined lecturer accounts...');
    
    for (const lecturer of lecturers) {
        try {
            console.log(`Creating account for ${lecturer.email}...`);
            
            const signUpResponse = await EmailPassword.signUp("public", lecturer.email, lecturer.password);
            
            if (signUpResponse.status === 'OK') {
                console.log(`✓ Successfully created account for ${lecturer.name} (${lecturer.email})`);
            } else if (signUpResponse.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
                console.log(`- Account for ${lecturer.email} already exists`);
            } else {
                console.error(`✗ Failed to create account for ${lecturer.email}:`, signUpResponse);
            }
        } catch (error) {
            console.error(`✗ Error creating account for ${lecturer.email}:`, error);
        }
    }
    
    console.log('\nUser setup completed!');
    console.log('\nPredefined accounts:');
    lecturers.forEach(lecturer => {
        console.log(`- ${lecturer.name}: ${lecturer.email} / ${lecturer.password}`);
    });
    
    process.exit(0);
}

// Run the setup
setupUsers().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
});
