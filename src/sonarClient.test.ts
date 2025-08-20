import { SonarClient } from './sonarClient';
import { TokenBucket } from './utils';

export class MockSonarClient extends SonarClient {
  constructor() {
    super('https://test.sonar.software/api/graphql', 'test_key');
    (this as any).rateLimiter = new TokenBucket(1000, 1000);
  }
}
