"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockSonarClient = void 0;
const sonarClient_1 = require("./sonarClient");
const utils_1 = require("./utils");
class MockSonarClient extends sonarClient_1.SonarClient {
    constructor() {
        super('https://test.sonar.software/api/graphql', 'test_key');
        this.rateLimiter = new utils_1.TokenBucket(1000, 1000);
    }
}
exports.MockSonarClient = MockSonarClient;
//# sourceMappingURL=sonarClient.test.js.map