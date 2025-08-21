import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.SONAR_API_URL = 'https://test.sonar.software/api/graphql';
process.env.SONAR_API_KEY = 'test_sonar_key';
process.env.LOCAL_TOOL_API_KEY = 'test_local_key';
process.env.PORT = '8081';
