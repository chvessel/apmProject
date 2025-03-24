# Exercise: Implementing APM Performance Gates with GitHub Actions


## Objectives

By the end of this exercise, you will:

1. Set up a Node.js application with New Relic instrumentation
2. Create GitHub Actions workflows for performance testing
3. Implement performance gates using APM metrics
4. Set up automated deployment decisions based on performance
5. Create a performance report as a workflow artifact

## Part 1: Application Setup

### Step 1: Repository

Start with a repository you made previously. Could be the semester project, or something else. it just needs:
- Node.js
- Express 


### Step 2: Add New Relic Instrumentation

1. Install the New Relic agent:

```bash
npm install newrelic --save
```

2. Create a `newrelic.js` configuration file in the project root:

```javascript
'use strict'

exports.config = {
  app_name: ['Express APM Demo'],
  license_key: 'YOUR_LICENSE_KEY',
  logging: {
    level: 'info'
  },
  distributed_tracing: {
    enabled: true
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  }
}
```

3. Update your application entry point (`app.js` or `index.js`) to require New Relic at the top:

```javascript
require('newrelic');
// rest of your app
```

4. Add a load testing script (`load-test.js`) to the project:

```javascript
const autocannon = require('autocannon');

// Configure the load test
async function runLoadTest() {
  console.log('Starting load test...');
  
  const result = await autocannon({
    url: 'http://localhost:3000',
    connections: 10,
    duration: 30,
    requests: [
      {
        method: 'GET',
        path: '/'
      },
      {
        method: 'GET',
        path: '/api/products'
      },
      {
        method: 'GET',
        path: '/api/users/1'
      }
    ]
  });
  
  console.log('Load test complete');
  console.log('Results:');
  console.log(`- Requests: ${result.requests.total}`);
  console.log(`- Throughput: ${result.throughput.total} bytes/sec`);
  console.log(`- Latency (avg): ${result.latency.average} ms`);
  console.log(`- Latency (p99): ${result.latency.p99} ms`);
  
  if (result.latency.p99 > 500) {
    console.error('Performance threshold exceeded!');
    process.exit(1);
  }
  
  process.exit(0);
}

runLoadTest().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
```

5. Install the autocannon dependency:

```bash
npm install autocannon --save-dev
```

6. Add a script to package.json:

```json
"scripts": {
  "start": "node app.js",
  "load-test": "node load-test.js"
}
```

### Step 3: Configure GitHub Secrets

Add your New Relic credentials to GitHub repository secrets:

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Add the following secrets:
   - `NEW_RELIC_LICENSE_KEY`: Your New Relic license key
   - `NEW_RELIC_API_KEY`: Your New Relic user API key
   - `NEW_RELIC_ACCOUNT_ID`: Your New Relic account ID

## Part 2: Create GitHub Actions Workflows 

### Step 1: Create a Performance Testing Workflow

Create a file `.github/workflows/performance-test.yml`:

```yaml
name: Performance Test

on:
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '14'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Create New Relic config
        run: |
            cat > newrelic.js << 'EOF'
            'use strict'
        
            exports.config = {
            app_name: ['Express APM Demo - CI'],
            license_key: '${{ secrets.NEW_RELIC_LICENSE_KEY }}',
            logging: {
                level: 'info'
            },
            distributed_tracing: {
                enabled: true
            },
            allow_all_headers: true
            }
            EOF
      
      - name: Run application with load test
        run: |
          npm start &
          APP_PID=$!
          echo "Started app with PID: $APP_PID"
          
          # Wait for app to start
          sleep 10
          
          # Run load test
          npm run load-test
          
          # Kill the app
          kill $APP_PID
      
      - name: Check APM metrics
        id: apm-check
        uses: newrelic/newrelic-action@v1
        with:
          account_id: ${{ secrets.NEW_RELIC_ACCOUNT_ID }}
          api_key: ${{ secrets.NEW_RELIC_API_KEY }}
          query: "SELECT average(duration) FROM Transaction WHERE appName = 'Express APM Demo - CI' SINCE 5 minutes ago"
          threshold: "500"
          operator: "below"
          
      - name: Generate performance report
        run: |
          echo "# Performance Test Results" > performance-report.md
          echo "" >> performance-report.md
          echo "Run on: $(date)" >> performance-report.md
          echo "" >> performance-report.md
          echo "## Response Time" >> performance-report.md
          echo "Average: ${{ steps.apm-check.outputs.value }} ms" >> performance-report.md
          echo "" >> performance-report.md
          echo "## Status" >> performance-report.md
          if [[ "${{ steps.apm-check.outcome }}" == "success" ]]; then
            echo "✅ Performance test passed" >> performance-report.md
          else
            echo "❌ Performance test failed" >> performance-report.md
          fi
      
      - name: Upload performance report
        uses: actions/upload-artifact@v3
        with:
          name: performance-report
          path: performance-report.md
```

### Step 2: Create a Deployment Workflow with Performance Gate

Create a file `.github/workflows/deploy.yml`:

```yaml
name: Deploy with Performance Gate

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  performance-gate:
    runs-on: ubuntu-latest
    outputs:
      performance_status: ${{ steps.performance-check.outputs.status }}
    steps:
      - name: Check recent performance metrics
        id: performance-check
        uses: newrelic/newrelic-action@v1
        with:
          account_id: ${{ secrets.NEW_RELIC_ACCOUNT_ID }}
          api_key: ${{ secrets.NEW_RELIC_API_KEY }}
          query: "SELECT average(duration) FROM Transaction WHERE appName = 'Express APM Demo' SINCE 1 hour ago"
          threshold: "300"
          operator: "below"
        continue-on-error: true
      
      - name: Set performance status
        id: set-status
        run: |
          if [[ "${{ steps.performance-check.outcome }}" == "success" ]]; then
            echo "status=pass" >> $GITHUB_OUTPUT
          else
            echo "status=fail" >> $GITHUB_OUTPUT
          fi
  
  deploy-staging:
    needs: performance-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '14'
      
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Your deployment steps here
      
      - name: Mark deployment in New Relic
        uses: newrelic/deployment-marker-action@v1
        with:
          api_key: ${{ secrets.NEW_RELIC_API_KEY }}
          account_id: ${{ secrets.NEW_RELIC_ACCOUNT_ID }}
          app_name: 'Express APM Demo'
          revision: ${{ github.sha }}
          user: ${{ github.actor }}
          description: 'Deployed to staging'
  
  deploy-production:
    needs: [performance-gate, deploy-staging]
    runs-on: ubuntu-latest
    if: needs.performance-gate.outputs.performance_status == 'pass'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '14'
      
      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # Your production deployment steps here
      
      - name: Mark deployment in New Relic
        uses: newrelic/deployment-marker-action@v1
        with:
          api_key: ${{ secrets.NEW_RELIC_API_KEY }}
          account_id: ${{ secrets.NEW_RELIC_ACCOUNT_ID }}
          app_name: 'Express APM Demo'
          revision: ${{ github.sha }}
          user: ${{ github.actor }}
          description: 'Deployed to production'
  
  notify-performance-issue:
    needs: performance-gate
    if: needs.performance-gate.outputs.performance_status == 'fail'
    runs-on: ubuntu-latest
    steps:
      - name: Send notification
        run: |
          echo "Performance gate failed - sending notification"
          # In a real scenario, you would notify via Slack, email, etc.
          # For example with Slack:
          # curl -X POST -H 'Content-type: application/json' --data '{"text":"⚠️ Performance gate failed for deployment"}' ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Step 3: Create a Weekly Performance Report Workflow

Create a file `.github/workflows/weekly-report.yml`:

```yaml
name: Weekly Performance Report

on:
  schedule:
    - cron: '0 0 * * 1'  # Run every Monday at midnight
  workflow_dispatch:  # Allow manual trigger

jobs:
  generate-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Fetch performance data
        id: perf-avg
        uses: newrelic/newrelic-action@v1
        with:
          account_id: ${{ secrets.NEW_RELIC_ACCOUNT_ID }}
          api_key: ${{ secrets.NEW_RELIC_API_KEY }}
          query: "SELECT average(duration) FROM Transaction WHERE appName = 'Express APM Demo' FACET name LIMIT 5 SINCE 1 week ago"
          output_type: json
          
      - name: Fetch error rate
        id: error-rate
        uses: newrelic/newrelic-action@v1
        with:
          account_id: ${{ secrets.NEW_RELIC_ACCOUNT_ID }}
          api_key: ${{ secrets.NEW_RELIC_API_KEY }}
          query: "SELECT percentage(count(*), WHERE error IS true) FROM Transaction WHERE appName = 'Express APM Demo' SINCE 1 week ago"
      
      - name: Generate markdown report
        run: |
          echo "# Weekly Performance Report" > performance-report.md
          echo "Generated on $(date)" >> performance-report.md
          echo "" >> performance-report.md
          
          echo "## Summary" >> performance-report.md
          echo "" >> performance-report.md
          echo "- Error rate: ${{ steps.error-rate.outputs.value }}%" >> performance-report.md
          echo "" >> performance-report.md
          
          echo "## Top 5 Transactions by Response Time" >> performance-report.md
          echo "" >> performance-report.md
          echo "| Transaction | Average Duration (ms) |" >> performance-report.md
          echo "|-------------|----------------------|" >> performance-report.md
          
          # Parse JSON results and add to markdown table
          # (In a real workflow, you would use jq or a script to parse the JSON properly)
          echo "Parsed performance data would be displayed here in a table format" >> performance-report.md
          
          echo "" >> performance-report.md
          echo "## Recommendations" >> performance-report.md
          echo "" >> performance-report.md
          echo "- Review the slowest transactions" >> performance-report.md
          echo "- Investigate any error rate increases" >> performance-report.md
          
      - name: Upload performance report
        uses: actions/upload-artifact@v3
        with:
          name: weekly-performance-report
          path: performance-report.md
```

## Part 3: Test Your Implementation

### Step 1: Commit and Push Changes

Commit your changes and push them to GitHub:

```bash
git add .
git commit -m "Add APM instrumentation and GitHub Actions workflows"
git push origin main
```

### Step 2: Manually Trigger Workflows

1. Go to your GitHub repository
2. Navigate to the "Actions" tab
3. Find the "Performance Test" workflow
4. Click "Run workflow" to manually trigger it
5. Wait for the workflow to complete

### Step 3: Review Results

1. When the workflow finishes, view the details
2. Check if the performance test passed or failed
3. Check the "Artifacts" section to find the performance report
4. Download and review the report

### Step 4: Create a Pull Request to Trigger the Workflow

1. Create a new branch:
```bash
git checkout -b feature/update-endpoint
```

2. Make a small change to the application, for example:
```javascript
// Add a new endpoint or modify an existing one
app.get('/api/test', (req, res) => {
  // Simulate some processing
  const result = [];
  for (let i = 0; i < 1000; i++) {
    result.push({ id: i, value: Math.random() });
  }
  res.json(result);
});
```

3. Commit and push the changes:
```bash
git add .
git commit -m "Add test endpoint"
git push origin feature/update-endpoint
```

4. Create a Pull Request on GitHub
5. Observe the performance test workflow running automatically


## Bonus Challenge: Slack Integration (Only if you use slack)

If you have time, add Slack notifications to your workflows:

1. Create a Slack app and webhook URL
2. Add the webhook URL as a GitHub secret: `SLACK_WEBHOOK_URL`
3. Add notification steps to your workflows:

```yaml
- name: Send Slack notification
  uses: slackapi/slack-github-action@v1.23.0
  with:
    payload: |
      {
        "text": "Performance Test Results",
        "blocks": [
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "Performance Test Results"
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Average response time: ${{ steps.apm-check.outputs.value }} ms"
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Status: ${{ steps.apm-check.outcome == 'success' && '✅ Passed' || '❌ Failed' }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Deliverables

By the end of this exercise, you should have:

1. A Node.js application instrumented with New Relic APM
2. Three GitHub Actions workflows:
   - Performance testing for pull requests
   - Deployment with performance gates
   - Weekly performance reporting
3. Performance reports as workflow artifacts
4. Optional: Slack integration for notifications




## Extension Ideas

For those who finish early or want to continue exploring:

1. **Implement A/B Performance Testing**:
   - Modify the workflow to compare performance between two branches
   - Create a visualization showing the performance difference

2. **Add Frontend Performance Monitoring**:
   - Add browser monitoring to your application
   - Create a workflow that tests and monitors frontend performance


3. **Create a Performance Dashboard**:
   - Use GitHub Pages to host a dashboard of your performance metrics
   - Update it automatically with each workflow run

4. **Implement Canary Deployments**:
   - Modify the deployment workflow to implement canary releases
   - Use APM data to automatically promote or rollback canaries



## Additional Documentation

### Understanding New Relic NRQL Queries

The New Relic Query Language (NRQL) is used in this exercise to retrieve metrics. Here are some examples:

```sql
-- Basic transaction performance
SELECT average(duration) FROM Transaction WHERE appName = 'Your App'

-- Error rate
SELECT percentage(count(*), WHERE error IS true) FROM Transaction 

-- Apdex score (user satisfaction)
SELECT apdex(duration, t:0.5) FROM Transaction

-- Response time percentiles
SELECT percentile(duration, 95) FROM Transaction

-- Performance by endpoint
SELECT average(duration) FROM Transaction FACET name LIMIT 10

-- Database operation time
SELECT average(databaseDuration) FROM Transaction
```

### Key Performance Indicators to Consider

When setting up performance gates, consider these important metrics:

1. **Response Time**: How quickly your application responds to requests
2. **Error Rate**: Percentage of requests resulting in errors
3. **Throughput**: Number of requests your application can handle
4. **Apdex Score**: User satisfaction based on response times
5. **CPU/Memory Usage**: Resource utilization during load
6. **Database Query Time**: Duration of database operations
7. **External Service Calls**: Time spent waiting for external services

For each metric, establish:
- Baseline: Normal operating value
- Warning threshold: When to investigate
- Critical threshold: When to block deployment
